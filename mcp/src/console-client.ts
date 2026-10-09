import type {
  EnvironmentConfig,
  EvaluationContext,
  Flag,
  FlagResult,
  FlagType,
  ProjectSummary,
  Segment,
  Strategy,
} from "./types.ts"

type ClientOptions = {
  url: string
  /** A Pennant access token (pnt_...), created on the console's Tokens page. */
  token: string
  clientKey?: string
  fetch?: typeof fetch
}

/** Who the token acts as, from GET /api/auth/session. */
type Identity = {
  user: { id: string; email: string; name: string; role: string; projectIds: string[] }
  token?: { name: string; scope: "read" | "write"; projectIds: string[] }
}

type ChangeRequest = { id: string; flagKey: string; environment: string; status: string }

type ToggleResult =
  | { mode: "direct"; flag: Flag }
  | { mode: "change-request"; changeRequest: ChangeRequest; flag: Flag }

class ConsoleError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Talks to the Pennant console with an access token. The token acts as its owner,
 * narrowed by its scope and projects, so roles and production approvals still apply.
 */
function createConsoleClient(options: ClientOptions) {
  const fetchImpl = options.fetch ?? fetch

  async function request<T>(
    method: string,
    path: string,
    project?: string,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${options.url}${path}`)
    if (project) url.searchParams.set("project", project)

    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      const message = await errorText(response, `${method} ${path} failed.`)
      throw new ConsoleError(
        response.status,
        response.status === 401
          ? `${message} Create a new token on the console's Tokens page and update PENNANT_TOKEN.`
          : message,
      )
    }
    return (await response.json()) as T
  }

  async function evaluate(environment: string, context: EvaluationContext, project?: string) {
    if (!options.clientKey) return null
    const response = await fetchImpl(`${options.url}/api/client/evaluate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.clientKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ environment, context, ...(project ? { project } : {}) }),
    })
    if (!response.ok) {
      throw new ConsoleError(response.status, await errorText(response, "Evaluate failed."))
    }
    const body = (await response.json()) as { flags?: Record<string, FlagResult> }
    return body.flags ?? {}
  }

  return {
    hasClientKey: Boolean(options.clientKey),
    evaluate,
    async whoami() {
      return request<Identity>("GET", "/api/auth/session")
    },
    async listProjects() {
      return (await request<{ projects: ProjectSummary[] }>("GET", "/api/admin/projects")).projects
    },
    async listEnvironments(project: string) {
      return (await request<{ environments: string[] }>("GET", "/api/admin/environments", project))
        .environments
    },
    async listFlags(project: string, includeArchived = false) {
      const path = includeArchived ? "/api/admin/flags?archived=1" : "/api/admin/flags"
      return (await request<{ flags: Flag[] }>("GET", path, project)).flags
    },
    async getFlag(project: string, key: string) {
      return (
        await request<{ flag: Flag }>("GET", `/api/admin/flags/${encodeURIComponent(key)}`, project)
      ).flag
    },
    async listSegments(project: string) {
      return (await request<{ segments: Segment[] }>("GET", "/api/admin/segments", project))
        .segments
    },
    async createFlag(
      project: string,
      input: {
        key: string
        name: string
        description?: string
        type?: FlagType
        strategy?: Strategy
      },
    ) {
      return (await request<{ flag: Flag }>("POST", "/api/admin/flags", project, input)).flag
    },
    async updateFlag(project: string, key: string, patch: Record<string, unknown>) {
      return (
        await request<{ flag: Flag }>(
          "PATCH",
          `/api/admin/flags/${encodeURIComponent(key)}`,
          project,
          patch,
        )
      ).flag
    },
    async setEnabled(project: string, key: string, environment: string, enabled: boolean) {
      return request<ToggleResult>(
        "POST",
        `/api/admin/flags/${encodeURIComponent(key)}/toggle`,
        project,
        {
          environment,
          enabled,
        },
      )
    },
    async approvalRequired(project: string) {
      const body = await request<{ requireApprovalForProduction: boolean }>(
        "GET",
        "/api/admin/change-requests",
        project,
      )
      return body.requireApprovalForProduction
    },
    async proposeProductionChange(project: string, flagKey: string, proposed: EnvironmentConfig) {
      return request<{ changeRequest: ChangeRequest }>(
        "POST",
        "/api/admin/change-requests",
        project,
        {
          flagKey,
          environment: "production",
          proposed,
        },
      )
    },
  }
}

async function errorText(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === "string" ? body.error : fallback
  } catch {
    return fallback
  }
}

type ConsoleClient = ReturnType<typeof createConsoleClient>

export { ConsoleError, createConsoleClient }
export type { ChangeRequest, ConsoleClient, Identity, ToggleResult }
