type PennantEnvironment = string

type PennantEvaluationContext = {
  userId?: string
  sessionId?: string
  remoteAddress?: string
  hostname?: string
  properties?: Record<string, string>
}

type PennantFlagMap = Record<string, { enabled: boolean; variant?: string }>

type PennantClientOptions = {
  apiUrl: string
  clientKey: string
  environment?: PennantEnvironment
  /** Project id. Omitted requests evaluate the project that owns the client key. */
  project?: string
  context?: PennantEvaluationContext
  fetch?: typeof globalThis.fetch
}

type PennantClient = {
  evaluate: (context?: PennantEvaluationContext) => Promise<PennantFlagMap>
  getFlags: () => PennantFlagMap
  isEnabled: (key: string) => boolean
  getVariant: (key: string) => string | undefined
}

function createPennantClient(options: PennantClientOptions): PennantClient {
  const {
    apiUrl,
    clientKey,
    environment = "development",
    project,
    context: defaultContext = {},
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
  } = options

  let flags: PennantFlagMap = {}

  async function evaluate(
    context: PennantEvaluationContext = defaultContext,
  ): Promise<PennantFlagMap> {
    const base = apiUrl.replace(/\/$/, "")
    const response = await fetchImpl(`${base}/api/client/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${clientKey}`,
      },
      body: JSON.stringify({
        context,
        environment,
        ...(project ? { project } : {}),
      }),
    })
    const body = (await response.json().catch(() => null)) as {
      error?: string
      flags?: PennantFlagMap
    } | null
    if (!response.ok) {
      throw new Error(body?.error ?? `Evaluation failed (${response.status}).`)
    }
    flags = body?.flags ?? {}
    return flags
  }

  function getFlags(): PennantFlagMap {
    return flags
  }

  function isEnabledFlag(key: string): boolean {
    return flags[key]?.enabled ?? false
  }

  function getVariantFlag(key: string): string | undefined {
    return flags[key]?.variant
  }

  return {
    evaluate,
    getFlags,
    isEnabled: isEnabledFlag,
    getVariant: getVariantFlag,
  }
}

function isEnabled(flags: PennantFlagMap, key: string): boolean {
  return flags[key]?.enabled ?? false
}

function getVariant(flags: PennantFlagMap, key: string): string | undefined {
  return flags[key]?.variant
}

export { createPennantClient, getVariant, isEnabled }
export type {
  PennantClient,
  PennantClientOptions,
  PennantEnvironment,
  PennantEvaluationContext,
  PennantFlagMap,
}
