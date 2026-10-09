# Pennant SDKs

Client libraries for the Pennant evaluate API. Every SDK matches `CONTRACT.md`. The React SDK is the behavioural baseline.

Each SDK lives in its own folder: `react/`, `js/`, `vue/`, `node/` (npm workspaces under `@pennant/*`), `python/` (PyPI `pennant-sdk`, import `pennant`), `go/` (module `github.com/flypennant/pennant-sdks/go`), `rust/` (crate `pennant-sdk`, lib `pennant`), `java/` (Maven `com.flypennant:pennant-sdk`), `kotlin/` (Gradle `com.flypennant:pennant-kotlin`), `ios/` (Swift package `Pennant`; the root `Package.swift` points at it so SwiftPM can install from the repo URL), `android/` (Gradle `com.flypennant:pennant-android`), `php/` (Composer `flypennant/pennant`), `dotnet/` (NuGet `Pennant.Sdk`, namespace `Pennant`), `flutter/` (pub `pennant_flutter`).

`mcp/` is `@pennant/mcp`, a stdio Model Context Protocol server that signs in to a Pennant console as a user and exposes read, explain, write, and SDK-setup tools. `skills/` holds customer-facing agent skills (`SKILL.md` folders); `.agents/skills` holds this repo's own development skills.

JS packages build with `tsc` to `<sdk>/dist`. Source imports use explicit `.ts`/`.tsx` extensions; `rewriteRelativeImportExtensions` turns them into `.js` in the output. Tests run straight from source with `node --experimental-strip-types`.

In `.ts` and `.tsx` files, every `export` and `export default` goes at the bottom. Declare the value or type first, then export it after the rest of the module. `"use client"` and imports stay at the top. ESLint enforces this with `pennant/exports-at-bottom`.

`npm run check` runs typecheck, lint, format-check, and tests for the JS side. Python uses Ruff and pytest in `python/`. Go uses gofmt, `go vet`, and `go test` in `go/`. Rust uses `cargo fmt`, Clippy with `-D warnings`, and `cargo test` in `rust/`. Java uses `mvn test` in `java/`. Kotlin uses `gradle test` in `kotlin/`. Android uses `gradle testDebugUnitTest` in `android/`. iOS uses `swift test` in `ios/`. PHP uses `composer lint` and `composer test` in `php/`. .NET uses `dotnet format --verify-no-changes` and `dotnet test` in `dotnet/`. Flutter uses `dart format`, `flutter analyze`, and `flutter test` in `flutter/`. CI runs all of them.

Every SDK turns a 4xx/5xx response into its error type, using the body's `error` string when it is JSON and `Evaluation failed (<status>).` otherwise (a proxy can answer with HTML). Clients meant to be shared keep their last result thread-safe.

Husky runs lint-staged (ESLint + Prettier) on commit, commitlint on commit-msg, and `npm run check` pieces on push. Commits follow Conventional Commits; the header is at most 100 characters.

Releases follow `.agents/skills/pennant-semver`. After CI passes on `main`, `.github/workflows/release.yml` bumps each SDK whose folder changed, tags `<sdk>/vX.Y.Z`, creates a GitHub release, and publishes. npm uses trusted publishing (no secret). PyPI, crates.io, and NuGet publish when `PYPI_TOKEN`, `CARGO_REGISTRY_TOKEN`, or `NUGET_API_KEY` is set. Do not tag releases by hand. `npm run release` prints the plan without publishing.

Agent skills live in `.agents/skills`. `.cursor` and `.claude` are gitignored. `prepare` recreates `.cursor/skills` and `.claude/skills` as symlinks to `.agents/skills`.
