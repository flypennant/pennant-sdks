import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { readConfig } from "./config.ts"
import { ConsoleError, createConsoleClient } from "./console-client.ts"

type Call = { url: string; method: string; headers: Record<string, string> }

const TOKEN = "pnt_0123456789abcdefghijklmnopqrstuvwxyzABCD"

/** A tiny fake console that accepts one access token. */
function fakeConsole() {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = { ...((init?.headers ?? {}) as Record<string, string>) }
    calls.push({ url, method: init?.method ?? "GET", headers })
    if (headers.Authorization !== `Bearer ${TOKEN}`) {
      return new Response(
        JSON.stringify({ error: "That access token is invalid, expired, or revoked." }),
        {
          status: 401,
        },
      )
    }
    if (url.includes("/api/admin/flags/missing")) {
      return new Response(JSON.stringify({ error: "No flag with that key." }), { status: 404 })
    }
    if (url.includes("/api/auth/session")) {
      return new Response(
        JSON.stringify({
          user: {
            id: "ada",
            email: 'ada@example.com via token "Claude"',
            name: "Ada",
            role: "editor",
            projectIds: ["web"],
          },
          token: { name: "Claude", scope: "write", projectIds: [] },
        }),
        { status: 200 },
      )
    }
    if (url.includes("/api/admin/flags"))
      return new Response(JSON.stringify({ flags: [] }), { status: 200 })
    return new Response("{}", { status: 200 })
  }) as typeof fetch
  return { calls, fetchImpl }
}

describe("console client", () => {
  it("sends the token as a bearer header, with no cookie, and scopes to the project", async () => {
    const { calls, fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      token: TOKEN,
      fetch: fetchImpl,
    })
    await client.listFlags("web")
    const [call] = calls
    assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`)
    assert.equal(call.headers.Cookie, undefined)
    assert.equal(call.headers.Origin, undefined)
    assert.match(call.url, /project=web/)
  })

  it("reports who the token acts as", async () => {
    const { fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      token: TOKEN,
      fetch: fetchImpl,
    })
    const identity = await client.whoami()
    assert.equal(identity.user.role, "editor")
    assert.equal(identity.token?.scope, "write")
  })

  it("tells the user to replace a rejected token", async () => {
    const { fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      token: "pnt_revoked_token_value_000000000000000",
      fetch: fetchImpl,
    })
    await assert.rejects(client.listFlags("web"), (error: unknown) => {
      assert.ok(error instanceof ConsoleError)
      assert.equal(error.status, 401)
      assert.match(error.message, /Tokens page/)
      return true
    })
  })

  it("surfaces the console's error message", async () => {
    const { fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      token: TOKEN,
      fetch: fetchImpl,
    })
    await assert.rejects(client.getFlag("web", "missing"), (error: unknown) => {
      assert.ok(error instanceof ConsoleError)
      assert.equal(error.status, 404)
      assert.equal(error.message, "No flag with that key.")
      return true
    })
  })

  it("skips live evaluation without a client key", async () => {
    const { fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      token: TOKEN,
      fetch: fetchImpl,
    })
    assert.equal(await client.evaluate("production", {}), null)
  })
})

describe("readConfig", () => {
  it("requires a URL and a token", () => {
    assert.match(readConfig({}) as string, /PENNANT_URL and PENNANT_TOKEN/)
  })

  it("rejects the old email and password settings", () => {
    const result = readConfig({
      PENNANT_URL: "https://x.example",
      PENNANT_TOKEN: TOKEN,
      PENNANT_PASSWORD: "pw",
    })
    assert.match(result as string, /no longer supported/)
  })

  it("rejects a client key passed as the token", () => {
    const result = readConfig({
      PENNANT_URL: "https://x.example",
      PENNANT_TOKEN: "pennant_client_key",
    })
    assert.match(result as string, /starting with pnt_/)
  })

  it("normalises the URL and reads the options", () => {
    const config = readConfig({
      PENNANT_URL: "https://flags.example.com/console/",
      PENNANT_TOKEN: TOKEN,
      PENNANT_READ_ONLY: "1",
    })
    assert.ok(typeof config !== "string")
    assert.equal(config.url, "https://flags.example.com")
    assert.equal(config.token, TOKEN)
    assert.equal(config.project, "default")
    assert.equal(config.readOnly, true)
  })
})
