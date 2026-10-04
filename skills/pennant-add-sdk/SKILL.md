---
name: pennant-add-sdk
description: Add a Pennant feature-flag SDK to a codebase. Use when the user wants to start using Pennant, connect an app to a Pennant console, install @pennant/react, @pennant/vue, @pennant/js, @pennant/node, or the Python, Go, or Rust SDK, or asks "how do I check a Pennant flag here".
---

# Add the Pennant SDK

Goal: the app evaluates Pennant flags with one shared client, configured from environment variables, with every flag reading as off when Pennant is unreachable.

## 1. Pick the SDK

If the Pennant MCP server is connected, call `detect_stack` on the project root, then `sdk_setup` for each match. Use its output for the install line and code.

Otherwise, read the manifests yourself:

| Found                                  | SDK                                     |
| -------------------------------------- | --------------------------------------- |
| `react` in package.json                | `@pennant/react`                        |
| `vue` in package.json                  | `@pennant/vue`                          |
| Express, Fastify, Koa, Hono, or NestJS | `@pennant/node` (server side)           |
| A browser app without React or Vue     | `@pennant/js`                           |
| `pyproject.toml` or `requirements.txt` | Python `pennant-sdk`                    |
| `go.mod`                               | `github.com/flypennant/pennant-sdks/go` |
| `Cargo.toml`                           | Rust `pennant-sdk`                      |

A full-stack app often needs two: a browser SDK for the UI and `@pennant/node` for the server.

Install lines:

```bash
npm install @pennant/react   # or @pennant/vue, @pennant/js, @pennant/node
pip install "pennant-sdk @ git+https://github.com/flypennant/pennant-sdks.git@python/v1.1.0#subdirectory=python"
go get github.com/flypennant/pennant-sdks/go@latest
cargo add pennant-sdk --rename pennant --git https://github.com/flypennant/pennant-sdks --tag rust/v1.1.0
```

## 2. Configure it from the environment

Never write a client key into source. Add these to the project's env example file and config loader:

- Server SDKs: `PENNANT_API_URL` and `PENNANT_CLIENT_KEY`.
- Browser SDKs: use the framework's public prefix, for example `VITE_PENNANT_CLIENT_KEY` or `NEXT_PUBLIC_PENNANT_CLIENT_KEY`. The client key only reads flag results, so it is safe in a browser bundle, but it still belongs in configuration.
- Ask the user for the console URL and tell them the client key is on the project's **Configure** page.

## 3. Create one client

- React: wrap the app once in `PennantProvider` with `apiUrl`, `clientKey`, `environment`, and `context={{ userId }}`. In the Next.js App Router, render it from a `"use client"` component.
- Vue: wrap the root in `PennantProvider` (`api-url`, `client-key`, `environment`, `:context`).
- Browser JS: one `createPennantClient({ apiUrl, clientKey, environment, context })`, then `await client.evaluate()`.
- Node, Python, Go, Rust: one client per process, created at startup. Evaluate per request with that request's user: `client.evaluate({ userId })`.

Put the client next to the app's other service setup, following the codebase's existing patterns. Do not create a client per request.

## 4. Context

Send a stable `userId` whenever there is a signed-in user. Gradual rollouts and variants depend on it, and a missing id means the user is outside every percentage rollout. Add `properties` for anything targeting rules use, such as `plan` or `region`. Values must be strings.

## 5. Fail safe

Unknown flags read as off. Make sure an evaluate error is also treated as off: catch it in server code and continue with the current behaviour. Do not block a request on Pennant.

## 6. Verify

- Typecheck or build the project.
- With the console running, check one flag end to end. If the MCP server is connected, `explain_flag` shows why it is on or off.
- Tell the user which environment variables to set in each deployed environment.
