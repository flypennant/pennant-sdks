import assert from "node:assert/strict"
import { afterEach, describe, it, mock } from "node:test"

import { createPennantClient, getVariant, isEnabled } from "./index.ts"

describe("@pennant/js client", () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it("POSTs to /api/client/evaluate with Bearer client key and contract fields", async () => {
    const fetchMock = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), "http://127.0.0.1:3847/api/client/evaluate")
      assert.equal(init?.method, "POST")
      const headers = new Headers(init?.headers)
      assert.equal(headers.get("Authorization"), "Bearer pennant-client-demo")
      assert.equal(headers.get("Content-Type"), "application/json")
      assert.deepEqual(JSON.parse(String(init?.body)), {
        context: {
          userId: "ada",
          remoteAddress: "127.0.0.1",
          hostname: "app.local",
        },
        environment: "production",
        project: "default",
      })
      return new Response(
        JSON.stringify({
          flags: {
            "checkout-v2": { enabled: true, variant: "treatment" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })

    const client = createPennantClient({
      apiUrl: "http://127.0.0.1:3847/",
      clientKey: "pennant-client-demo",
      environment: "production",
      project: "default",
      context: {
        userId: "ada",
        remoteAddress: "127.0.0.1",
        hostname: "app.local",
      },
      fetch: fetchMock as typeof globalThis.fetch,
    })
    const flags = await client.evaluate()
    assert.equal(fetchMock.mock.callCount(), 1)
    assert.equal(client.isEnabled("checkout-v2"), true)
    assert.equal(client.getVariant("checkout-v2"), "treatment")
    assert.equal(isEnabled(flags, "checkout-v2"), true)
    assert.equal(getVariant(flags, "checkout-v2"), "treatment")
    assert.equal(isEnabled(flags, "missing"), false)
    assert.equal(getVariant(flags, "missing"), undefined)
  })

  it("throws when evaluation fails", async () => {
    const client = createPennantClient({
      apiUrl: "http://127.0.0.1:3847",
      clientKey: "bad-key",
      fetch: (async () => {
        return new Response(JSON.stringify({ error: "Invalid client key." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }) as typeof globalThis.fetch,
    })
    await assert.rejects(() => client.evaluate(), /Invalid client key/)
  })
})
