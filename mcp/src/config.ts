type McpConfig = {
  /** Public URL of the Pennant console, such as https://flags.example.com. */
  url: string
  email: string
  password: string
  /** Project used when a tool call does not name one. */
  project: string
  /** Optional project client key. Lets explain_flag confirm results against the live evaluate API. */
  clientKey?: string
  /** When true, tools that change flags are not registered. */
  readOnly: boolean
}

type Env = Record<string, string | undefined>

function readConfig(env: Env = process.env): McpConfig | string {
  const url = env.PENNANT_URL?.trim()
  const email = env.PENNANT_EMAIL?.trim()
  const password = env.PENNANT_PASSWORD
  const missing = [
    url ? null : "PENNANT_URL",
    email ? null : "PENNANT_EMAIL",
    password ? null : "PENNANT_PASSWORD",
  ].filter(Boolean)
  if (missing.length > 0) return `Set ${missing.join(", ")} for the Pennant MCP server.`

  let parsed: URL
  try {
    parsed = new URL(url!)
  } catch {
    return "PENNANT_URL must be a full URL, such as https://flags.example.com."
  }

  return {
    url: parsed.origin,
    email: email!,
    password: password!,
    project: env.PENNANT_PROJECT?.trim() || "default",
    clientKey: env.PENNANT_CLIENT_KEY?.trim() || undefined,
    readOnly: env.PENNANT_READ_ONLY === "1" || env.PENNANT_READ_ONLY === "true",
  }
}

export { readConfig }
export type { McpConfig }
