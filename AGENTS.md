# Pennant SDKs

Client libraries for the Pennant evaluate API. Every SDK matches `CONTRACT.md`. The React SDK is the behavioural baseline.

Each SDK lives in its own folder: `react/`, `js/`, `vue/`, `node/` (npm workspaces under `@pennant/*`), `python/` (PyPI `pennant-sdk`, import `pennant`), `go/` (module `github.com/flypennant/pennant-sdks/go`), `rust/` (crate `pennant-sdk`, lib `pennant`).

JS packages build with `tsc` to `<sdk>/dist`. Source imports use explicit `.ts`/`.tsx` extensions; `rewriteRelativeImportExtensions` turns them into `.js` in the output. Tests run straight from source with `node --experimental-strip-types`.

In `.ts` and `.tsx` files, every `export` and `export default` goes at the bottom. Declare the value or type first, then export it after the rest of the module. `"use client"` and imports stay at the top. ESLint enforces this with `pennant/exports-at-bottom`.

`npm run check` runs typecheck, lint, format-check, and tests for the JS side. Python uses Ruff and pytest in `python/`. Go uses gofmt, `go vet`, and `go test` in `go/`. Rust uses `cargo fmt`, Clippy with `-D warnings`, and `cargo test` in `rust/`. CI runs all of them.

Husky runs lint-staged (ESLint + Prettier) on commit, commitlint on commit-msg, and `npm run check` pieces on push. Commits follow Conventional Commits; the header is at most 100 characters.

Releases follow `.agents/skills/pennant-semver`. After CI passes on `main`, `.github/workflows/release.yml` bumps each SDK whose folder changed, tags `<sdk>/vX.Y.Z`, creates a GitHub release, and publishes. npm uses trusted publishing (no secret). PyPI and crates.io publish when `PYPI_TOKEN` or `CARGO_REGISTRY_TOKEN` is set. Do not tag releases by hand. `npm run release` prints the plan without publishing.

Agent skills live in `.agents/skills`. `.cursor` and `.claude` are gitignored. `prepare` recreates `.cursor/skills` and `.claude/skills` as symlinks to `.agents/skills`.
