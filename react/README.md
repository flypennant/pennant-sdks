# @pennant/react

React client for [Pennant](../../README.md). The provider polls `POST /api/client/evaluate` and exposes the result to hooks and the `Flag` component.

## Install

```bash
npm install https://github.com/gizmo0506/pennant/releases/download/sdk%2Freact%2Fv1.0.0/pennant-react-1.0.0.tgz
```

You do not need this monorepo. A local checkout can still use `npm install ./sdk/react`.

## Usage

```tsx
import { Flag, PennantProvider, useFlag, usePennant } from "@pennant/react"

export function App() {
  return (
    <PennantProvider
      apiUrl="http://127.0.0.1:3847"
      clientKey="pennant-client-demo"
      environment="development"
      context={{ userId: "ada-lovelace" }}
      pollIntervalMs={15000}
    >
      <Dashboard />
    </PennantProvider>
  )
}

function Dashboard() {
  const checkout = useFlag("checkout-v2")
  const { refetch } = usePennant()

  return (
    <>
      <button type="button" onClick={() => refetch()}>
        Refresh flags
      </button>
      <Flag name="new-dashboard" fallback={<p>The classic dashboard is still up.</p>}>
        <p>The new dashboard is flying.</p>
      </Flag>
      {checkout ? <p>Checkout v2 is on.</p> : null}
    </>
  )
}
```

`apiUrl` is the Pennant origin. An empty string uses the current origin. Gradual rollout stays off unless `context.userId` is set. The same `userId` always hashes to the same bucket for a flag.

`context` accepts `userId`, `sessionId`, `remoteAddress`, `hostname`, and a `properties` string map. Those fields match `POST /api/client/evaluate` (see `sdk/CONTRACT.md`). Variant stickiness uses `userId`, then `sessionId`.
