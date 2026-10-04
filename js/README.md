# @pennant/js

Vanilla browser (and fetch-capable) client for [Pennant](../README.md). Matches the shared contract in [`CONTRACT.md`](../CONTRACT.md). No React or Vue dependency.

## Install

```bash
npm install @pennant/js
```

From a local checkout of this repo: `npm install ./js`.

## Usage

```ts
import { createPennantClient, getVariant, isEnabled } from "@pennant/js"

const client = createPennantClient({
  apiUrl: "http://127.0.0.1:3847",
  clientKey: "pennant-client-demo",
  environment: "development",
  context: { userId: "ada-lovelace" },
})

const flags = await client.evaluate()
if (client.isEnabled("checkout-v2")) {
  console.log("variant", client.getVariant("checkout-v2"))
}

// Or read from the returned map:
if (isEnabled(flags, "checkout-v2")) {
  console.log("variant", getVariant(flags, "checkout-v2"))
}
```

`evaluate` POSTs to `/api/client/evaluate` with `Authorization: Bearer <clientKey>`. Pass optional `project` when you want the body to assert the key belongs to that project.
