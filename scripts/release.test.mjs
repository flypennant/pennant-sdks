import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PACKAGES,
  bumpVersion,
  latestVersion,
  parseConventionalCommit,
  planPackage,
  previousVersion,
  releaseCommitMessage,
  releaseNotes,
  textFromStdout,
} from "./release-plan.mjs"
import { updateCargoLock, updatePackageLock, updateTomlVersion } from "./release-versions.mjs"

const react = PACKAGES.find((pkg) => pkg.id === "react")
const go = PACKAGES.find((pkg) => pkg.id === "go")

function commit(hash, message, files) {
  return { hash, message, files }
}

describe("conventional commits", () => {
  it("reads feat, fix, and breaking marks", () => {
    assert.equal(parseConventionalCommit("feat: add flags").type, "feat")
    assert.equal(parseConventionalCommit("fix(api): drop stale key").type, "fix")
    assert.equal(parseConventionalCommit("feat!: replace evaluate").breaking, true)
    assert.equal(parseConventionalCommit("chore: tidy readme").breaking, false)
    assert.equal(
      parseConventionalCommit("feat: change client\n\nBREAKING CHANGE: key is required").breaking,
      true,
    )
    assert.equal(parseConventionalCommit("Keep exports at the bottom"), null)
  })

  it("bumps semver and picks the highest tag", () => {
    assert.equal(bumpVersion("0.1.0", "patch"), "0.1.1")
    assert.equal(bumpVersion("0.1.0", "minor"), "0.2.0")
    assert.equal(bumpVersion("0.1.0", "major"), "1.0.0")
    assert.equal(bumpVersion("1.2.3", "major"), "2.0.0")
    assert.equal(latestVersion(["go/v0.9.0", "go/v0.10.0", "react/v9.0.0"], "go/v"), "0.10.0")
    assert.equal(latestVersion(["go/v0.1.0", "go/v0.1.2"], "go/v"), "0.1.2")
    assert.equal(
      previousVersion(["go/v0.1.0", "go/v0.1.1", "react/v0.2.0"], "go/v", "0.1.1"),
      "0.1.0",
    )
    assert.equal(previousVersion(["go/v0.1.0"], "go/v", "0.1.0"), null)
    assert.equal(textFromStdout(null), "")
    assert.equal(textFromStdout("v0.1.0\n"), "v0.1.0")
  })
})

describe("release plan", () => {
  it("publishes the manifest version for every package when nothing is tagged", () => {
    const plans = PACKAGES.map((pkg) =>
      planPackage({ ...pkg, version: "1.1.0" }, { latest: null, commits: [] }),
    )
    assert.deepEqual(
      plans.map((plan) => plan.tag),
      [
        "react/v1.1.0",
        "js/v1.1.0",
        "vue/v1.1.0",
        "node/v1.1.0",
        "python/v1.1.0",
        "go/v1.1.0",
        "rust/v1.1.0",
      ],
    )
    assert.equal(
      plans.every((plan) => plan.initial),
      true,
    )
  })

  it("releases only the SDKs whose folder changed", () => {
    const commits = [commit("aaa1111", "feat: add evaluate helper", ["react/src/index.ts"])]
    const reactPlan = planPackage({ ...react, version: "1.0.0" }, { latest: "1.0.0", commits })
    const goPlan = planPackage({ ...go, version: "1.0.0" }, { latest: "1.0.0", commits })
    assert.equal(reactPlan.version, "1.1.0")
    assert.equal(reactPlan.level, "minor")
    assert.equal(goPlan, null)
  })

  it("ignores root files such as README and CONTRACT", () => {
    const commits = [commit("bbb2222", "docs: tidy", ["README.md", "CONTRACT.md"])]
    assert.equal(planPackage({ ...react, version: "1.0.0" }, { latest: "1.0.0", commits }), null)
  })

  it("promotes a 0.x tag to 1.0.0 on the next change", () => {
    const commits = [commit("abc1234", "fix: retry once", ["go/client.go"])]
    const plan = planPackage({ ...go, version: "0.1.0" }, { latest: "0.1.0", commits })
    assert.equal(plan.tag, "go/v1.0.0")
    assert.equal(plan.level, "major")
  })

  it("patch-releases for a chore and treats a breaking change as major", () => {
    const chore = [commit("ccc3333", "chore: tidy", ["react/README.md"])]
    const breaking = [
      commit("ddd4444", "fix: adjust hash\n\nBREAKING CHANGE: buckets start at zero", [
        "go/client.go",
      ]),
    ]
    assert.equal(
      planPackage({ ...react, version: "1.2.3" }, { latest: "1.2.3", commits: chore }).version,
      "1.2.4",
    )
    assert.equal(
      planPackage({ ...go, version: "1.4.2" }, { latest: "1.4.2", commits: breaking }).version,
      "2.0.0",
    )
  })

  it("ignores the release commit so the bot does not publish again", () => {
    const commits = [
      commit("eee5555", "chore(release): react/v1.1.1 [skip ci]", ["react/package.json"]),
    ]
    assert.equal(planPackage({ ...react, version: "1.1.1" }, { latest: "1.1.1", commits }), null)
  })

  it("writes newest-first notes and a short release subject", () => {
    const plan = planPackage(
      { ...react, version: "1.0.0" },
      {
        latest: "1.0.0",
        commits: [
          commit("aaa1111", "fix: empty allowlist", ["react/src/provider.tsx"]),
          commit("fff6666", "feat: add tags", ["react/src/flag.tsx"]),
        ],
      },
    )
    const notes = releaseNotes(plan)
    assert.match(notes, /## Features\n- add tags \(fff6666\)/)
    assert.match(notes, /## Bug fixes\n- empty allowlist \(aaa1111\)/)
    assert.ok(notes.indexOf("add tags") < notes.indexOf("empty allowlist"))
    const message = releaseCommitMessage([plan, { tag: "go/v1.0.1" }])
    assert.match(message, /^chore\(release\): 2 packages \[skip ci\]/)
  })
})

describe("version files", () => {
  it("updates one workspace in the lockfile and leaves the others", () => {
    const lock = `{
  "packages": {
    "": { "name": "pennant-sdks" },
    "react": { "version": "1.0.0" },
    "vue": { "version": "1.0.0" }
  }
}
`
    const data = JSON.parse(updatePackageLock(lock, { packages: { react: "1.1.0" } }))
    assert.equal(data.packages.react.version, "1.1.0")
    assert.equal(data.packages.vue.version, "1.0.0")
  })

  it("updates python and rust versions in place", () => {
    assert.match(updateTomlVersion('version = "0.1.0"\n', "0.2.0"), /version = "0.2.0"/)
    const cargo =
      'name = "once_cell"\nversion = "1.21.4"\n\nname = "pennant-sdk"\nversion = "0.1.0"\n'
    const next = updateCargoLock(cargo, "0.2.0")
    assert.match(next, /name = "once_cell"\nversion = "1.21.4"/)
    assert.match(next, /name = "pennant-sdk"\nversion = "0.2.0"/)
  })
})
