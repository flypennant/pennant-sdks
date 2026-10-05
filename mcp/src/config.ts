type McpConfig = {
  /** Public URL of the Pennant console, such as https://flags.example.com. */
  url: string
  /** Access token (pnt_...) from the console's Tokens page. */
  token: string
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
  const token = env.PENNANT_TOKEN?.trim()
  const missing = [url ? null : "PENNANT_URL", token ? null : "PENNANT_TOKEN"].filter(Boolean)
  if (missing.length > 0) {
    return `Set ${missing.join(" and ")} for the Pennant MCP server. Create a token on the console's Tokens page.`
  }
  if (env.PENNANT_EMAIL || env.PENNANT_PASSWORD) {
    return "PENNANT_EMAIL and PENNANT_PASSWORD are no longer supported. Remove them and use PENNANT_TOKEN."
  }
  if (!token!.startsWith("pnt_")) {
    return "PENNANT_TOKEN must be a Pennant access token starting with pnt_. A project client key will not work here."
  }

  let parsed: URL
  try {
    parsed = new URL(url!)
  } catch {
    return "PENNANT_URL must be a full URL, such as https://flags.example.com."
  }

  return {
    url: parsed.origin,
    token: token!,
    project: env.PENNANT_PROJECT?.trim() || "default",
    clientKey: env.PENNANT_CLIENT_KEY?.trim() || undefined,
    readOnly: env.PENNANT_READ_ONLY === "1" || env.PENNANT_READ_ONLY === "true",
  }
}

export { readConfig }
export type { McpConfig }
