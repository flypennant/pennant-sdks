# Pennant SDKs

Client libraries for [Pennant](https://flypennant.si), a self-hosted feature-flag console. Every SDK calls `POST /api/client/evaluate` with a project client key. [`CONTRACT.md`](CONTRACT.md) describes the request and response.

| SDK | Install | Import |
| --- | --- | --- |
| [React](react/) | `npm install @pennant/react` | `@pennant/react` |
| [Browser JS](js/) | `npm install @pennant/js` | `@pennant/js` |
| [Vue](vue/) | `npm install @pennant/vue` | `@pennant/vue` |
| [Node](node/) | `npm install @pennant/node` | `@pennant/node` |
| [Python](python/) | `pip install pennant-sdk` | `import pennant` |
| [Go](go/) | `go get github.com/flypennant/pennant-sdks/go` | `pennant` |
| [Rust](rust/) | `pennant = { package = "pennant-sdk", version = "1" }` | `pennant` |

PyPI and crates.io already have unrelated packages called `pennant`, so those two publish as `pennant-sdk`. The import name is still `pennant`.

## Develop

```bash
npm install
npm run build   # tsc → <sdk>/dist for the four JS packages
npm test        # JS SDK tests and release planning tests
```

Python, Go, and Rust run their own tests: `pytest` in `python/`, `go test ./...` in `go/`, `cargo test` in `rust/`.

## Versions and tags

Each SDK is versioned on its own. Tags are `<sdk>/vX.Y.Z`, for example `react/v1.2.0` or `go/v1.0.3`. The prefix must match the folder because Go resolves module versions that way. Use conventional commits. A `feat` touching `react/` bumps the React minor. A `fix` or `chore` bumps the patch. A breaking change bumps the major. `scripts/release-plan.mjs` works out the next version for each SDK from those commits.
