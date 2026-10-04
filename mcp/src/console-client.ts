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
  email: string
  password: string
  clientKey?: string
  fetch?: typeof fetch
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
 * Talks to the Pennant console as a signed-in user, so roles, project membership,
 * and production approvals apply exactly as they do in the browser.
 */
function createConsoleClient(options: ClientOptions) {
  const fetchImpl = options.fetch ?? fetch
  let cookie: string | null = null

  async function signIn() {
    const response = await fetchImpl(`${options.url}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: options.url },
      body: JSON.stringify({ email: options.email, password: options.password }),
    })
    if (!response.ok) {
      throw new ConsoleError(response.status, await errorText(response, "Sign-in failed."))
    }
    const setCookie = response.headers.get("set-cookie")
    const session = setCookie?.split(";")[0]
    if (!session) throw new ConsoleError(500, "Sign-in did not return a session.")
    cookie = session
  }

  async function request<T>(
    method: string,
    path: string,
    project?: string,
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${options.url}${path}`)
    if (project) url.searchParams.set("project", project)

    for (let attempt = 0; attempt < 2; attempt++) {
      if (!cookie) await signIn()
      const response = await fetchImpl(url, {
        method,
        headers: {
          Cookie: cookie!,
          Origin: options.url,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      // An expired session gets one fresh sign-in.
      if (response.status === 401 && attempt === 0) {
        cookie = null
        continue
      }
      if (!response.ok) {
        throw new ConsoleError(
          response.status,
          await errorText(response, `${method} ${path} failed.`),
        )
      }
      return (await response.json()) as T
    }
    throw new ConsoleError(401, "Sign-in required.")
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
export type { ChangeRequest, ConsoleClient, ToggleResult }
