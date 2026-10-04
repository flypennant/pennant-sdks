import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { explainFlag } from "./explain.ts"
import type { EnvironmentConfig, Flag, Segment } from "./types.ts"

function flag(
  key: string,
  production: Partial<EnvironmentConfig>,
  extra: Partial<Flag> = {},
): Flag {
  return {
    key,
    name: key,
    description: "",
    type: "release",
    tags: [],
    archived: false,
    environments: {
      production: { enabled: true, strategy: { type: "everyone" }, ...production },
    },
    ...extra,
  }
}

function lookups(
  flags: Flag[],
  segments: Segment[] = [],
  live?: Record<string, { enabled: boolean; variant?: string }>,
) {
  return {
    flags: new Map(flags.map((item) => [item.key, item])),
    segments: new Map(segments.map((item) => [item.id, item])),
    live,
  }
}

describe("explainFlag", () => {
  it("stops at an archived flag or a switched-off environment", () => {
    const archived = flag("a", {}, { archived: true })
    assert.equal(explainFlag(archived, "production", {}, lookups([archived])).enabled, false)
    const off = flag("b", { enabled: false })
    const result = explainFlag(off, "production", {}, lookups([off]))
    assert.equal(result.enabled, false)
    assert.match(result.reason, /switched off in production/)
    assert.match(
      explainFlag(off, "staging", {}, lookups([off])).reason,
      /no settings for the staging/,
    )
  })

  it("names the constraint that failed", () => {
    const pro = flag("pro", {
      constraints: [{ contextName: "plan", operator: "IN", values: ["pro"] }],
    })
    const free = explainFlag(pro, "production", { properties: { plan: "free" } }, lookups([pro]))
    assert.equal(free.enabled, false)
    assert.match(free.reason, /plan is one of pro/)
    assert.equal(
      explainFlag(pro, "production", { properties: { plan: "pro" } }, lookups([pro])).enabled,
      true,
    )
  })

  it("checks segments by their constraints", () => {
    const segment: Segment = {
      id: "seg-eu",
      name: "EU",
      description: "",
      constraints: [{ contextName: "region", operator: "IN", values: ["eu"] }],
    }
    const eu = flag("eu-only", { segmentIds: ["seg-eu"] })
    const us = explainFlag(
      eu,
      "production",
      { properties: { region: "us" } },
      lookups([eu], [segment]),
    )
    assert.equal(us.enabled, false)
    assert.match(us.reason, /not in segment "EU"/)
    assert.equal(
      explainFlag(eu, "production", { properties: { region: "eu" } }, lookups([eu], [segment]))
        .enabled,
      true,
    )
  })

  it("follows the parent flag", () => {
    const parent = flag("parent", { enabled: false })
    const child = flag("child", {}, { parentKey: "parent" })
    const result = explainFlag(child, "production", {}, lookups([parent, child]))
    assert.equal(result.enabled, false)
    assert.match(result.reason, /Parent flag parent is off/)
  })

  it("defers a partial rollout to the server unless a live result is given", () => {
    const rollout = flag("rollout", { strategy: { type: "gradual", percentage: 30 } })
    const unknown = explainFlag(rollout, "production", { userId: "u1" }, lookups([rollout]))
    assert.equal(unknown.enabled, null)
    const inside = explainFlag(
      rollout,
      "production",
      { userId: "u1" },
      lookups([rollout], [], { rollout: { enabled: true } }),
    )
    assert.equal(inside.enabled, true)
    const noUser = explainFlag(rollout, "production", {}, lookups([rollout]))
    assert.equal(noUser.enabled, false)
    assert.match(noUser.reason, /need a userId/)
  })

  it("keeps a child uncertain when its parent's rollout is unknown", () => {
    const parent = flag("parent", { strategy: { type: "gradual", percentage: 50 } })
    const child = flag("child", {}, { parentKey: "parent" })
    assert.equal(
      explainFlag(child, "production", { userId: "u1" }, lookups([parent, child])).enabled,
      null,
    )
    const live = { parent: { enabled: false }, child: { enabled: false } }
    assert.equal(
      explainFlag(child, "production", { userId: "u1" }, lookups([parent, child], [], live))
        .enabled,
      false,
    )
  })

  it("reports the variant from a live result", () => {
    const exp = flag("exp", {
      variants: [
        { name: "a", weight: 50 },
        { name: "b", weight: 50 },
      ],
    })
    const result = explainFlag(
      exp,
      "production",
      { userId: "u1" },
      lookups([exp], [], { exp: { enabled: true, variant: "b" } }),
    )
    assert.match(result.reason, /variant "b"/)
  })
})
