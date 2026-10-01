# @pennant/vue

Vue client for [Pennant](../../README.md). Matches the shared contract in `sdk/CONTRACT.md` and the React baseline at `sdk/react`. Vue is a peer dependency.

## Install

```bash
npm install https://github.com/gizmo0506/pennant/releases/download/sdk%2Fvue%2Fv1.0.0/pennant-vue-1.0.0.tgz
```

You do not need this monorepo. A local checkout can still use `npm install ./sdk/vue`.

## Evaluate client

```ts
import { createPennantClient } from "@pennant/vue"

const client = createPennantClient({
  apiUrl: "http://127.0.0.1:3847",
  clientKey: "pennant-client-demo",
  environment: "development",
  context: { userId: "ada-lovelace" },
})

const flags = await client.evaluate()
if (client.isEnabled("checkout-v2")) {
  console.log(client.getVariant("checkout-v2"))
}
```

## Provider, composables, and Flag

```ts
import { createApp } from "vue"
import { Flag, PennantProvider, useFlag, useVariant } from "@pennant/vue"

createApp({
  components: { Flag, PennantProvider },
  setup() {
    const checkout = useFlag("checkout-v2")
    const variant = useVariant("checkout-v2")
    return { checkout, variant }
  },
  template: `
    <PennantProvider
      api-url="http://127.0.0.1:3847"
      client-key="pennant-client-demo"
      environment="development"
      :context="{ userId: 'ada-lovelace' }"
    >
      <Flag name="new-dashboard">
        <p>The new dashboard is on.</p>
        <template #fallback>
          <p>The classic dashboard is still up.</p>
        </template>
      </Flag>
      <p v-if="checkout">Checkout variant: {{ variant }}</p>
    </PennantProvider>
  `,
}).mount("#app")
```

`PennantProvider` polls `POST /api/client/evaluate` with `Authorization: Bearer <clientKey>`. You can also call `installPennant(app, options)` to provide flags at the app root.
