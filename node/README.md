# @pennant/node

Node.js server client for [Pennant](../../README.md). Matches the shared contract in `sdk/CONTRACT.md`. No React or DOM dependency. Uses global `fetch` (Node 20+).

## Install

```bash
npm install https://github.com/gizmo0506/pennant/releases/download/sdk%2Fnode%2Fv1.0.0/pennant-node-1.0.0.tgz
```

You do not need this monorepo. A local checkout can still use `npm install ./sdk/node`.

## Usage

```ts
import { createPennantClient } from "@pennant/node"

const client = createPennantClient({
  apiUrl: "http://127.0.0.1:3847",
  clientKey: "pennant-client-demo",
  environment: "production",
  context: { userId: "ada-lovelace", remoteAddress: "10.0.0.2" },
})

const flags = await client.evaluate()
if (client.isEnabled("checkout-v2")) {
  console.log("variant", client.getVariant("checkout-v2"))
}
```

`evaluate` POSTs to `/api/client/evaluate` with `Authorization: Bearer <clientKey>`.
