---
name: module-exports
description: Put every export statement at the bottom of a TypeScript or TSX module. Use when writing, reviewing, or refactoring .ts and .tsx files, including React components, route handlers, and library modules.
---

# Exports at the bottom

Imports stay at the top. Declarations stay in the middle. Every `export` and `export default` is the last statement in the file.

## When to Apply

- Writing a new `.ts` or `.tsx` module
- Adding a function, component, type, or constant another module needs
- Reviewing or refactoring a file that exports from the middle

## Rule

Declare values and types without `export`. Collect the public surface in one block at the bottom.

**Incorrect: exports scattered through the file**

```tsx
export const ENVIRONMENTS = ["development", "production"] as const

export type EnvironmentName = (typeof ENVIRONMENTS)[number]

export function environmentLabel(environment: EnvironmentName) {
  return environment === "production" ? "Production" : "Development"
}
```

**Correct: one export block at the bottom**

```tsx
const ENVIRONMENTS = ["development", "production"] as const

type EnvironmentName = (typeof ENVIRONMENTS)[number]

function environmentLabel(environment: EnvironmentName) {
  return environment === "production" ? "Production" : "Development"
}

export { ENVIRONMENTS, environmentLabel }
export type { EnvironmentName }
```

A default export is also last:

```tsx
function HomePage() {
  return <FlagsView />
}

export default HomePage
```

Next.js route segment config such as `dynamic` must be a direct `export const`.
The Next.js compiler cannot parse a re-export of those names. Keep that as:

```ts
export const dynamic = "force-dynamic"

async function GET() {
  return Response.json({ ok: true })
}

export { GET }
```

Allowed segment-config names for a direct `export const`: `dynamic`, `dynamicParams`,
`revalidate`, `fetchCache`, `runtime`, `preferredRegion`, and `maxDuration`.

Everything else still goes at the bottom with `export { … }` / `export type { … }` /
`export default Name`.

`"use client"`, `"use server"`, and imports stay above the declarations. Do not place an export between them and the rest of the file.
