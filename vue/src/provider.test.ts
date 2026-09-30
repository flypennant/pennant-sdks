import assert from "node:assert/strict"
import { afterEach, describe, it, mock } from "node:test"
import { createApp, createSSRApp, h, ref } from "vue"
import { renderToString } from "vue/server-renderer"

import { Flag, installPennant, pennantKey, useFlag, useVariant } from "./provider.ts"
import type { PennantFlagMap } from "./client.ts"

describe("@pennant/vue composables and Flag", () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it("provides useFlag and useVariant from evaluated flags", async () => {
    const fetchMock = mock.fn(async () => {
      return new Response(
        JSON.stringify({
          flags: {
            "checkout-v2": { enabled: true, variant: "treatment" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as typeof globalThis.fetch
    const app = createApp({})
    try {
      const state = installPennant(app, {
        apiUrl: "http://127.0.0.1:3847",
        clientKey: "pennant-client-demo",
        pollIntervalMs: 0,
      })
      await state.refetch()
      assert.equal(fetchMock.mock.callCount() >= 1, true)

      app.runWithContext(() => {
        const enabled = useFlag("checkout-v2")
        const variant = useVariant("checkout-v2")
        assert.equal(enabled.value, true)
        assert.equal(variant.value, "treatment")
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("renders Flag children only when the flag is on", async () => {
    const flags: PennantFlagMap = {
      "new-dashboard": { enabled: true },
      "checkout-v2": { enabled: false },
    }

    const app = createSSRApp({
      render: () =>
        h("div", [
          h(Flag, { name: "new-dashboard" }, { default: () => h("p", "on") }),
          h(
            Flag,
            { name: "checkout-v2" },
            {
              default: () => h("p", "should-not-show"),
              fallback: () => h("p", "fallback"),
            },
          ),
        ]),
    })
    app.provide(pennantKey, {
      flags: ref(flags),
      loading: ref(false),
      error: ref(null),
      refetch: async () => {},
    })

    const html = await renderToString(app)
    assert.match(html, /on/)
    assert.match(html, /fallback/)
    assert.doesNotMatch(html, /should-not-show/)
  })
})
