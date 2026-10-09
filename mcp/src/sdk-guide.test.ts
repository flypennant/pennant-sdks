import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { SDKS, detectStack, setupGuide } from "./sdk-guide.ts"

function pkg(deps: Record<string, string>) {
  return new Map([["package.json", JSON.stringify({ dependencies: deps })]])
}

describe("detectStack", () => {
  it("picks React, Vue, and server SDKs from package.json", () => {
    assert.deepEqual(
      detectStack(pkg({ react: "19", next: "16" })).map((d) => [d.sdk, d.framework]),
      [["react", "next"]],
    )
    assert.equal(detectStack(pkg({ vue: "3" }))[0].sdk, "vue")
    assert.equal(detectStack(pkg({ express: "5" }))[0].sdk, "node")
    assert.equal(detectStack(pkg({ vite: "8" }))[0].sdk, "js")
  })

  it("finds a frontend and a server SDK in one full-stack app", () => {
    assert.deepEqual(
      detectStack(pkg({ react: "19", express: "5" })).map((d) => d.sdk),
      ["react", "node"],
    )
  })

  it("recognises Python, Go, Rust, Java, Kotlin, and iOS manifests", () => {
    const files = new Map([
      ["pyproject.toml", "[project]"],
      ["go.mod", "module x"],
      ["Cargo.toml", "[package]"],
      ["pom.xml", "<project/>"],
      ["build.gradle.kts", 'kotlin("jvm")'],
      ["Package.swift", "// swift-tools-version: 5.9"],
    ])
    assert.deepEqual(
      detectStack(files).map((d) => d.sdk),
      ["python", "go", "rust", "java", "kotlin", "ios"],
    )
  })

  it("recognises Android, PHP, .NET, and Flutter projects", () => {
    assert.deepEqual(
      detectStack(new Map([["build.gradle.kts", 'plugins { id("com.android.application") }']])).map(
        (d) => d.sdk,
      ),
      ["android"],
    )
    assert.deepEqual(
      detectStack(
        new Map([
          ["composer.json", "{}"],
          ["Shop.Api.csproj", ""],
          ["pubspec.yaml", "dependencies:\n  flutter:\n    sdk: flutter\n"],
        ]),
      ).map((d) => d.sdk),
      ["flutter", "php", "dotnet"],
    )
  })

  it("returns nothing for an empty directory", () => {
    assert.deepEqual(detectStack(new Map()), [])
  })
})

describe("setupGuide", () => {
  it("points every SDK at the console and never embeds a real key", () => {
    for (const sdk of SDKS) {
      const guide = setupGuide(sdk, { apiUrl: "https://flags.example.com", flagKey: "beta-search" })
      assert.ok(guide.install.length > 0, sdk)
      assert.match(guide.code, /beta-search/, sdk)
      assert.ok(
        guide.code.includes("https://flags.example.com") ||
          Object.values(guide.env).includes("https://flags.example.com"),
        sdk,
      )
      assert.ok(Object.values(guide.env).includes("<project client key>"), sdk)
    }
  })

  it("uses the framework's public env var for browser keys", () => {
    assert.ok(
      "NEXT_PUBLIC_PENNANT_CLIENT_KEY" in
        setupGuide("react", { apiUrl: "x", framework: "next" }).env,
    )
    assert.ok(
      "VITE_PENNANT_CLIENT_KEY" in setupGuide("react", { apiUrl: "x", framework: "vite" }).env,
    )
  })
})
