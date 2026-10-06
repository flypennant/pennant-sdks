---
name: pennant-semver
description: Pennant SDK SemVer and git tag rules. Use when bumping versions, cutting a release, choosing a tag, or deciding whether an SDK publish is required.
---

# Pennant SDK SemVer

Versions are `MAJOR.MINOR.PATCH` only. No prerelease, no build metadata. Tags are the source of truth. Do not tag by hand. `.github/workflows/release.yml` runs `scripts/release.mjs` after CI passes on `main`.

## Bump

Take the highest level among commits since that SDK's tag that touch its folder.

- `BREAKING CHANGE`, or `!` after the type (`feat!:`), is major. Minor and patch reset to 0.
- `feat` is minor. Patch resets to 0.
- `fix` is patch.
- Any other commit, including `chore`, `docs`, `refactor`, `perf`, `test`, `ci`, `style`, and a non-conventional subject, is patch.
- One push produces one bump per SDK. Two `feat` commits since the tag still raise minor once.

`chore(release):` is the bot commit. Ignore it. It must not start another release.

## What gets a tag

An SDK is tagged only when a commit since its last tag changes files under its folder. Root files such as `README.md`, `CONTRACT.md`, `scripts/`, and `.github/` never release anything.

| SDK     | Folder     | Tag              | Registry                         |
| ------- | ---------- | ---------------- | -------------------------------- |
| react   | `react/`   | `react/vX.Y.Z`   | npm `@pennant/react`             |
| js      | `js/`      | `js/vX.Y.Z`      | npm `@pennant/js`                |
| vue     | `vue/`     | `vue/vX.Y.Z`     | npm `@pennant/vue`               |
| node    | `node/`    | `node/vX.Y.Z`    | npm `@pennant/node`              |
| python  | `python/`  | `python/vX.Y.Z`  | PyPI `pennant-sdk`               |
| go      | `go/`      | `go/vX.Y.Z`      | Go proxy (tag only)              |
| rust    | `rust/`    | `rust/vX.Y.Z`    | crates.io `pennant-sdk`          |
| java    | `java/`    | `java/vX.Y.Z`    | Maven (tag for now)              |
| kotlin  | `kotlin/`  | `kotlin/vX.Y.Z`  | Maven (tag for now)              |
| ios     | `ios/`     | `ios/vX.Y.Z`     | Swift package (tag for now)      |
| android | `android/` | `android/vX.Y.Z` | Maven (tag for now)              |
| php     | `php/`     | `php/vX.Y.Z`     | Composer (tag for now)           |
| dotnet  | `dotnet/`  | `dotnet/vX.Y.Z`  | NuGet `Pennant.Sdk`              |
| flutter | `flutter/` | `flutter/vX.Y.Z` | pub git dependency (tag for now) |

The tag prefix must match the folder so `go get github.com/flypennant/pennant-sdks/go` resolves versions. At 2.0.0 the Go module path has to end in `/v2`.

## First tag

If an SDK has no tag yet, publish the version already written in its manifest. Do not bump that first tag. A `0.x` tag publishes `1.0.0` on the next change.

## Version files

After the first tag, write the new version back, then commit `chore(release): <tag> [skip ci]`. Use `scripts/release-versions.mjs`.

- npm SDKs: `<sdk>/package.json` and the `<sdk>` workspace entry in the root `package-lock.json`.
- Python: `python/pyproject.toml` only.
- Rust: `rust/Cargo.toml` and the `pennant-sdk` entry in `rust/Cargo.lock`.
- Java: `java/pom.xml` project version.
- Kotlin: `kotlin/build.gradle.kts` `version`.
- Android: `android/build.gradle.kts` `version`.
- .NET: `<Version>` in `dotnet/src/Pennant/Pennant.csproj`.
- Flutter: `version:` in `flutter/pubspec.yaml`.
- Go, iOS, and PHP have no version file. The tag is the version.

## Publishing

npm publishes through trusted publishing: each `@pennant/*` package trusts `flypennant/pennant-sdks` and `release.yml`, so there is no npm secret. PyPI and crates.io publish only when `PYPI_TOKEN` or `CARGO_REGISTRY_TOKEN` is set. The script skips a version npm already has, and twine skips existing files.
