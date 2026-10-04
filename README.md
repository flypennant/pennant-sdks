# Pennant SDKs

Client libraries for [Pennant](https://flypennant.com), a self-hosted feature-flag console. Every SDK calls `POST /api/client/evaluate` with a project client key. [`CONTRACT.md`](CONTRACT.md) describes the request and response.

| SDK               | Install                                                | Import           |
| ----------------- | ------------------------------------------------------ | ---------------- |
| [React](react/)   | `npm install @pennant/react`                           | `@pennant/react` |
| [Browser JS](js/) | `npm install @pennant/js`                              | `@pennant/js`    |
| [Vue](vue/)       | `npm install @pennant/vue`                             | `@pennant/vue`   |
| [Node](node/)     | `npm install @pennant/node`                            | `@pennant/node`  |
| [Python](python/) | `pip install pennant-sdk`                              | `import pennant` |
| [Go](go/)         | `go get github.com/flypennant/pennant-sdks/go`         | `pennant`        |
| [Rust](rust/)     | `pennant = { package = "pennant-sdk", version = "1" }` | `pennant`        |

## AI assistants

| Package                 | Install                                                  | Use                                                                                |
| ----------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [MCP server](mcp/)      | `npx -y @pennant/mcp`                                    | Let an assistant read, explain, and change flags, and wire an SDK into a codebase. |
| [Agent skills](skills/) | Copy into `.claude/skills` or your agent's skills folder | Step-by-step guides for adding the SDK, flagging a feature, and removing a flag.   |

PyPI and crates.io already have unrelated packages called `pennant`, so those two publish as `pennant-sdk`. The import name is still `pennant`.

## Develop

```bash
npm install       # also installs the husky hooks
npm run build     # tsc → <sdk>/dist for the four JS packages
npm run check     # typecheck, ESLint, Prettier, tests
npm run release   # print the next release plan without publishing
```

| SDK    | Lint and format                                               | Test            |
| ------ | ------------------------------------------------------------- | --------------- |
| JS     | `npm run lint`, `npm run format:check`                        | `npm test`      |
| Python | `ruff check .`, `ruff format --check .` in `python/`          | `pytest`        |
| Go     | `gofmt -l .`, `go vet ./...` in `go/`                         | `go test ./...` |
| Rust   | `cargo fmt --check`, `cargo clippy -- -D warnings` in `rust/` | `cargo test`    |

Commits follow [Conventional Commits](https://www.conventionalcommits.org). Husky runs lint-staged on commit, commitlint on the message, and the JS checks on push. CI runs every row of the table.

## Versions and tags

Each SDK is versioned on its own. Tags are `<sdk>/vX.Y.Z`, for example `react/v1.2.0` or `go/v1.0.3`. The prefix must match the folder because Go resolves module versions that way. Use conventional commits. A `feat` touching `react/` bumps the React minor. A `fix` or `chore` bumps the patch. A breaking change bumps the major. `scripts/release-plan.mjs` works out the next version for each SDK from those commits.

After CI passes on `main`, the Release workflow tags every SDK that changed, writes the new version into its manifest in a `chore(release)` commit, creates a GitHub release with notes, and publishes to the registry.

npm uses [trusted publishing](https://docs.npmjs.com/trusted-publishers). Each `@pennant/*` package on npmjs.com trusts `flypennant/pennant-sdks` and the `release.yml` workflow, so there is no npm secret. PyPI and crates.io publish when the `PYPI_TOKEN` or `CARGO_REGISTRY_TOKEN` repository secret is set. Without one, that registry is skipped and the tag and GitHub release still happen. Go needs nothing; the tag is the release.
