import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { readConfig } from "./config.ts"
import { ConsoleError, createConsoleClient } from "./console-client.ts"

type Call = { url: string; method: string; headers: Record<string, string>; body?: string }

/** A tiny fake console: signs in, then answers admin requests while the session is valid. */
function fakeConsole(options: { expireOnce?: boolean } = {}) {
  const calls: Call[] = []
  let session = 0
  let expired = false
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    )
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers,
      body: init?.body as string | undefined,
    })
    if (url.endsWith("/api/auth/sign-in")) {
      session++
      return new Response(JSON.stringify({ user: { id: "u" } }), {
        status: 200,
        headers: { "Set-Cookie": `pennant.session=s${session}; Path=/; HttpOnly` },
      })
    }
    if (options.expireOnce && !expired) {
      expired = true
      return new Response(JSON.stringify({ error: "Sign in required." }), { status: 401 })
    }
    if (url.includes("/api/admin/flags/missing")) {
      return new Response(JSON.stringify({ error: "No flag with that key." }), { status: 404 })
    }
    if (url.includes("/api/admin/flags"))
      return new Response(JSON.stringify({ flags: [] }), { status: 200 })
    return new Response("{}", { status: 200 })
  }) as typeof fetch
  return { calls, fetchImpl }
}

describe("console client", () => {
  it("signs in once, sends the session cookie and Origin, and scopes to the project", async () => {
    const { calls, fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      email: "a@b.c",
      password: "pw",
      fetch: fetchImpl,
    })
    await client.listFlags("web")
    await client.listFlags("web")
    assert.equal(calls.filter((c) => c.url.endsWith("/sign-in")).length, 1)
    const list = calls.find((c) => c.url.includes("/api/admin/flags"))!
    assert.equal(list.headers.Cookie, "pennant.session=s1")
    assert.equal(list.headers.Origin, "https://flags.example.com")
    assert.match(list.url, /project=web/)
  })

  it("signs in again once when the session expires", async () => {
    const { calls, fetchImpl } = fakeConsole({ expireOnce: true })
    const client = createConsoleClient({
      url: "https://flags.example.com",
      email: "a@b.c",
      password: "pw",
      fetch: fetchImpl,
    })
    await client.listFlags("web")
    assert.equal(calls.filter((c) => c.url.endsWith("/sign-in")).length, 2)
  })

  it("surfaces the console's error message", async () => {
    const { fetchImpl } = fakeConsole()
    const client = createConsoleClient({
      url: "https://flags.example.com",
      email: "a@b.c",
      password: "pw",
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
      email: "a@b.c",
      password: "pw",
      fetch: fetchImpl,
    })
    assert.equal(await client.evaluate("production", {}), null)
  })
})

describe("readConfig", () => {
  it("requires a URL and credentials", () => {
    assert.match(readConfig({}) as string, /PENNANT_URL, PENNANT_EMAIL, PENNANT_PASSWORD/)
    assert.match(
      readConfig({ PENNANT_URL: "nope", PENNANT_EMAIL: "a", PENNANT_PASSWORD: "b" }) as string,
      /full URL/,
    )
  })

  it("normalises the URL and reads the options", () => {
    const config = readConfig({
      PENNANT_URL: "https://flags.example.com/console/",
      PENNANT_EMAIL: "a@b.c",
      PENNANT_PASSWORD: "pw",
      PENNANT_READ_ONLY: "1",
    })
    assert.ok(typeof config !== "string")
    assert.equal(config.url, "https://flags.example.com")
    assert.equal(config.project, "default")
    assert.equal(config.readOnly, true)
  })
})
