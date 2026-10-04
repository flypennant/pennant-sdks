---
name: pennant-release-notes
description: Generate Pennant SDK GitHub release notes from conventional commits. Use when drafting a changelog, release body, or the chore(release) commit for an SDK tag.
---

# Pennant SDK release notes

Generate notes with `releaseNotes` in `scripts/release-plan.mjs`. Do not invent a second changelog shape. Keep each commit subject as written. Do not rewrite it into marketing copy.

## Input

Use the plan from `planPackage`. Notes list only the commits that decided the bump.

- Notes include only commits that touch that SDK's folder.
- Drop any commit whose subject starts with `chore(release):`.
- A breaking commit is listed once, under Breaking changes, even when its type is `feat` or `fix`.

## Body

Newest commit first. Each bullet is the conventional description, or the full subject when the commit is not conventional, then a space and the 7-character hash in parentheses.

```text
Initial release.

## Breaking changes
- replace evaluate (<hash>)

## Features
- add tags (<hash>)

## Bug fixes
- empty allowlist (<hash>)

## Other changes
- tidy copy (<hash>)
```

Rules for that body:

- Write `Initial release.` only for the first tag, when no previous tag exists. Put it above the sections.
- Omit any section that has no commits.
- If there is no initial line and no sections, the body is `Patch release.`
- End with a trailing newline.
- Section order is Breaking changes, Features, Bug fixes, Other changes.

## Release commit

When version files change, the commit is `releaseCommitMessage`. One tag:

```text
chore(release): react/v1.2.0 [skip ci]

- react/v1.2.0
```

More than one tag:

```text
chore(release): 2 packages [skip ci]

- react/v1.2.0
- go/v1.1.1
```

The subject must stay within 100 characters. `[skip ci]` stays on the subject so the version commit does not start another release.
