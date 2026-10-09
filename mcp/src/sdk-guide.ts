import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const SDKS = [
  "react",
  "vue",
  "js",
  "node",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "ios",
  "android",
  "php",
  "dotnet",
  "flutter",
] as const

type SdkId = (typeof SDKS)[number]

type Detection = { sdk: SdkId; reason: string; framework?: "next" | "vite" | "nuxt" }

type SetupGuide = {
  sdk: SdkId
  install: string
  env: Record<string, string>
  code: string
  notes: string[]
}

const MANIFESTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle.kts",
  "build.gradle",
  "Package.swift",
  "composer.json",
  "pubspec.yaml",
] as const

// .NET project files have the project's own name, so they are found by extension.
const DOTNET_PROJECT = /\.(csproj|fsproj|vbproj|sln|slnx)$/

const ANDROID_GRADLE =
  /com\.android\.(application|library)|android\.(application|library)|\bandroid\s*\{/

const SERVER_FRAMEWORKS = ["express", "fastify", "koa", "hono", "@nestjs/core", "@hapi/hapi"]

/** Picks SDKs from manifest file contents, keyed by file name. */
function detectStack(files: Map<string, string>): Detection[] {
  const found: Detection[] = []

  const pkgText = files.get("package.json")
  if (pkgText) {
    let deps: Record<string, string> = {}
    try {
      const pkg = JSON.parse(pkgText) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
      deps = { ...pkg.devDependencies, ...pkg.dependencies }
    } catch {
      deps = {}
    }
    const has = (name: string) => name in deps
    const framework = has("next") ? "next" : has("nuxt") ? "nuxt" : has("vite") ? "vite" : undefined
    if (has("react"))
      found.push({ sdk: "react", reason: "package.json depends on react.", framework })
    else if (has("vue"))
      found.push({ sdk: "vue", reason: "package.json depends on vue.", framework })
    const server = SERVER_FRAMEWORKS.find(has)
    if (server) found.push({ sdk: "node", reason: `package.json depends on ${server}.` })
    if (!has("react") && !has("vue") && !server) {
      found.push(
        framework === "vite"
          ? { sdk: "js", reason: "A Vite app without React or Vue.", framework }
          : { sdk: "node", reason: "A JavaScript project without a browser framework." },
      )
    }
  }
  if (files.has("pyproject.toml") || files.has("requirements.txt")) {
    found.push({
      sdk: "python",
      reason: files.has("pyproject.toml") ? "Found pyproject.toml." : "Found requirements.txt.",
    })
  }
  if (files.has("go.mod")) found.push({ sdk: "go", reason: "Found go.mod." })
  if (files.has("Cargo.toml")) found.push({ sdk: "rust", reason: "Found Cargo.toml." })
  // A Flutter app carries android/ and ios/ folders of its own; the Flutter SDK covers both.
  if (files.has("pubspec.yaml")) {
    const pubspec = files.get("pubspec.yaml") ?? ""
    found.push(
      /^\s+sdk:\s*flutter\b/m.test(pubspec)
        ? { sdk: "flutter", reason: "pubspec.yaml depends on Flutter." }
        : { sdk: "flutter", reason: "Found pubspec.yaml (the client also works in plain Dart)." },
    )
  }
  if (files.has("composer.json")) found.push({ sdk: "php", reason: "Found composer.json." })
  const dotnetProject = [...files.keys()].find((name) => DOTNET_PROJECT.test(name))
  if (dotnetProject) found.push({ sdk: "dotnet", reason: `Found ${dotnetProject}.` })
  if (files.has("pom.xml")) found.push({ sdk: "java", reason: "Found pom.xml." })
  const gradle = files.get("build.gradle.kts") ?? files.get("build.gradle")
  if (gradle !== undefined && ANDROID_GRADLE.test(gradle)) {
    found.push({ sdk: "android", reason: "The Gradle build uses the Android plugin." })
  } else if (gradle !== undefined) {
    const kotlinish =
      files.has("build.gradle.kts") ||
      /org\.jetbrains\.kotlin|kotlin\("jvm"\)|id\("org\.jetbrains\.kotlin/.test(gradle)
    if (kotlinish) {
      found.push({
        sdk: "kotlin",
        reason: files.has("build.gradle.kts")
          ? "Found build.gradle.kts."
          : "Found a Kotlin Gradle build.",
      })
    } else if (!files.has("pom.xml")) {
      found.push({ sdk: "java", reason: "Found build.gradle." })
    }
  }
  if (files.has("Package.swift")) found.push({ sdk: "ios", reason: "Found Package.swift." })
  return found
}

/** Reads the manifest files in one directory. Missing files are skipped. */
async function readManifests(dir: string) {
  const files = new Map<string, string>()
  await Promise.all(
    MANIFESTS.map(async (name) => {
      try {
        files.set(name, await readFile(path.join(dir, name), "utf8"))
      } catch {
        /* not present */
      }
    }),
  )
  try {
    for (const name of await readdir(dir)) {
      if (DOTNET_PROJECT.test(name)) files.set(name, "")
    }
  } catch {
    /* unreadable directory */
  }
  return files
}

function browserKeyVar(framework?: Detection["framework"]) {
  if (framework === "next") return "NEXT_PUBLIC_PENNANT_CLIENT_KEY"
  if (framework === "nuxt") return "NUXT_PUBLIC_PENNANT_CLIENT_KEY"
  return "VITE_PENNANT_CLIENT_KEY"
}

function browserEnvRead(framework: Detection["framework"], name: string) {
  return framework === "next" || framework === "nuxt"
    ? `process.env.${name}`
    : `import.meta.env.${name}`
}

/** Install line, environment variables, and a first flag check for one SDK. */
function setupGuide(
  sdk: SdkId,
  options: { apiUrl: string; flagKey?: string; framework?: Detection["framework"] },
): SetupGuide {
  const flag = options.flagKey ?? "new-checkout"
  const keyNote =
    "Copy the client key from the project's Configure page. It can only read flag results, but keep it in configuration, not source."
  const offNote = `Write the code so ${flag} being off is the safe path. Unknown flags read as off.`

  switch (sdk) {
    case "react": {
      const keyVar = browserKeyVar(options.framework)
      return {
        sdk,
        install: "npm install @pennant/react",
        env: { [keyVar]: "<project client key>" },
        code: `import { PennantProvider, useFlag } from "@pennant/react"

export function Root({ user, children }) {
  return (
    <PennantProvider
      apiUrl="${options.apiUrl}"
      clientKey={${browserEnvRead(options.framework, keyVar)}}
      environment="production"
      context={{ userId: user.id }}
    >
      {children}
    </PennantProvider>
  )
}

function Checkout() {
  const enabled = useFlag("${flag}")
  return enabled ? <NewCheckout /> : <ClassicCheckout />
}`,
        notes: [
          keyNote,
          offNote,
          "The provider refreshes every 15 seconds by default. Set pollIntervalMs to change it.",
          ...(options.framework === "next"
            ? ['In the Next.js App Router, render PennantProvider from a "use client" component.']
            : []),
        ],
      }
    }
    case "vue": {
      const keyVar = browserKeyVar(options.framework)
      return {
        sdk,
        install: "npm install @pennant/vue",
        env: { [keyVar]: "<project client key>" },
        code: `<script setup>
import { Flag, PennantProvider } from "@pennant/vue"
const clientKey = ${browserEnvRead(options.framework, keyVar)}
</script>

<template>
  <PennantProvider
    api-url="${options.apiUrl}"
    :client-key="clientKey"
    environment="production"
    :context="{ userId: user.id }"
  >
    <Flag name="${flag}">
      <NewCheckout />
    </Flag>
  </PennantProvider>
</template>`,
        notes: [
          keyNote,
          offNote,
          "useFlag and useVariant work in any component under PennantProvider.",
        ],
      }
    }
    case "js":
      return {
        sdk,
        install: "npm install @pennant/js",
        env: { VITE_PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import { createPennantClient } from "@pennant/js"

const pennant = createPennantClient({
  apiUrl: "${options.apiUrl}",
  clientKey: import.meta.env.VITE_PENNANT_CLIENT_KEY,
  environment: "production",
  context: { userId: currentUser.id },
})

await pennant.evaluate()
if (pennant.isEnabled("${flag}")) {
  showNewCheckout()
}`,
        notes: [keyNote, offNote, "Call evaluate again after sign-in or when the context changes."],
      }
    case "node":
      return {
        sdk,
        install: "npm install @pennant/node",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import { createPennantClient } from "@pennant/node"

const pennant = createPennantClient({
  apiUrl: process.env.PENNANT_API_URL,
  clientKey: process.env.PENNANT_CLIENT_KEY,
  environment: "production",
})

// Evaluate per request with that request's user.
const flags = await pennant.evaluate({ userId: req.user.id, remoteAddress: req.ip })
if (flags["${flag}"]?.enabled) {
  return newCheckout(req, res)
}`,
        notes: [
          keyNote,
          offNote,
          "Server SDKs evaluate when called, so pass the current user's context each time.",
        ],
      }
    case "python":
      return {
        sdk,
        install:
          'pip install "pennant-sdk @ git+https://github.com/flypennant/pennant-sdks.git@python/v1.1.0#subdirectory=python"',
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import os
from pennant import PennantClient

pennant = PennantClient(
    api_url=os.environ["PENNANT_API_URL"],
    client_key=os.environ["PENNANT_CLIENT_KEY"],
    environment="production",
)

flags = pennant.evaluate({"userId": user.id})
if flags.get("${flag}", {}).get("enabled"):
    return new_checkout(request)`,
        notes: [keyNote, offNote, "The package is pennant-sdk; the import name is pennant."],
      }
    case "go":
      return {
        sdk,
        install: "go get github.com/flypennant/pennant-sdks/go@latest",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import pennant "github.com/flypennant/pennant-sdks/go"

client := pennant.NewClient(pennant.ClientOptions{
	APIURL:      os.Getenv("PENNANT_API_URL"),
	ClientKey:   os.Getenv("PENNANT_CLIENT_KEY"),
	Environment: "production",
})

flags, err := client.Evaluate(&pennant.EvaluationContext{UserID: user.ID})
if err == nil && pennant.IsEnabledIn(flags, "${flag}") {
	return newCheckout(w, r)
}`,
        notes: [
          keyNote,
          offNote,
          "Treat an evaluate error as off, so an outage falls back to the current behaviour.",
        ],
      }
    case "rust":
      return {
        sdk,
        install:
          "cargo add pennant-sdk --rename pennant --git https://github.com/flypennant/pennant-sdks --tag rust/v1.1.0",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `use pennant::{is_enabled, Client, ClientOptions, EvaluationContext};

let mut client = Client::new(ClientOptions {
    api_url: std::env::var("PENNANT_API_URL")?,
    client_key: std::env::var("PENNANT_CLIENT_KEY")?,
    environment: "production".into(),
    project: None,
    context: EvaluationContext::default(),
});

let context = EvaluationContext { user_id: Some(user.id.clone()), ..EvaluationContext::default() };
let flags = client.evaluate(Some(&context))?;
if is_enabled(&flags, "${flag}") {
    return new_checkout(req);
}`,
        notes: [keyNote, offNote, "The crate is pennant-sdk; the library name is pennant."],
      }
    case "java":
      return {
        sdk,
        install:
          "Not on Maven Central yet. Clone flypennant/pennant-sdks, run `mvn install` in java/, then depend on com.flypennant:pennant-sdk:1.1.0.",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import com.flypennant.pennant.EvaluationContext;
import com.flypennant.pennant.PennantClient;

PennantClient pennant = PennantClient.builder()
    .apiUrl(System.getenv("PENNANT_API_URL"))
    .clientKey(System.getenv("PENNANT_CLIENT_KEY"))
    .environment("production")
    .build();

var flags = pennant.evaluate(EvaluationContext.builder().userId(user.getId()).build());
if (PennantClient.isEnabled(flags, "${flag}")) {
    return newCheckout(request);
}`,
        notes: [
          keyNote,
          offNote,
          "Treat an evaluate error as off, so an outage falls back to the current behaviour.",
        ],
      }
    case "kotlin":
      return {
        sdk,
        install:
          'Not on Maven Central yet. Clone flypennant/pennant-sdks, run `gradle publishToMavenLocal` in kotlin/, add mavenLocal(), then implementation("com.flypennant:pennant-kotlin:1.1.0").',
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import com.flypennant.pennant.ClientOptions
import com.flypennant.pennant.EvaluationContext
import com.flypennant.pennant.PennantClient

val pennant = PennantClient(
    ClientOptions(
        apiUrl = System.getenv("PENNANT_API_URL"),
        clientKey = System.getenv("PENNANT_CLIENT_KEY"),
        environment = "production",
    ),
)

val flags = pennant.evaluate(EvaluationContext(userId = user.id))
if (PennantClient.isEnabled(flags, "${flag}")) {
    return newCheckout(request)
}`,
        notes: [
          keyNote,
          offNote,
          "Treat an evaluate error as off, so an outage falls back to the current behaviour.",
        ],
      }
    case "ios":
      return {
        sdk,
        install:
          '.package(url: "https://github.com/flypennant/pennant-sdks", branch: "main") with the product "Pennant" (Xcode: File > Add Package Dependencies).',
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import Pennant

let pennant = PennantClient(
    options: ClientOptions(
        apiUrl: ProcessInfo.processInfo.environment["PENNANT_API_URL"] ?? "",
        clientKey: ProcessInfo.processInfo.environment["PENNANT_CLIENT_KEY"] ?? "",
        environment: "production"
    )
)

let flags = try await pennant.evaluate(EvaluationContext(userId: user.id))
if PennantClient.isEnabled(flags, key: "${flag}") {
    return newCheckout()
}`,
        notes: [
          keyNote,
          offNote,
          "Treat an evaluate error as off, so an outage falls back to the current behaviour.",
        ],
      }
    case "android":
      return {
        sdk,
        install:
          'Not on Maven Central yet. Clone flypennant/pennant-sdks, run `gradle publishToMavenLocal` in android/, add mavenLocal(), then implementation("com.flypennant:pennant-android:1.1.0").',
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import com.flypennant.pennant.android.ClientOptions
import com.flypennant.pennant.android.EvaluateCallback
import com.flypennant.pennant.android.EvaluationContext
import com.flypennant.pennant.android.FlagMap
import com.flypennant.pennant.android.PennantClient
import com.flypennant.pennant.android.PennantException

// Once, in Application.onCreate. Read the values from BuildConfig fields.
val pennant = PennantClient(
    ClientOptions(
        apiUrl = BuildConfig.PENNANT_API_URL,
        clientKey = BuildConfig.PENNANT_CLIENT_KEY,
        environment = "production",
    ),
)

pennant.evaluateAsync(EvaluationContext(userId = user.id), object : EvaluateCallback {
    override fun onSuccess(flags: FlagMap) {
        if (PennantClient.isEnabled(flags, "${flag}")) showNewCheckout()
    }

    override fun onError(error: PennantException) = Unit // stay on the current checkout
})`,
        notes: [
          keyNote,
          offNote,
          "Pass PENNANT_API_URL and PENNANT_CLIENT_KEY in as buildConfigField values from gradle properties.",
          "evaluate() blocks; call it off the main thread, or use evaluateAsync, which calls back on the main thread.",
        ],
      }
    case "php":
      return {
        sdk,
        install:
          "Not on Packagist yet. Add the php/ folder of a flypennant/pennant-sdks checkout as a Composer path repository, then composer require flypennant/pennant.",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `use Pennant\\EvaluationContext;
use Pennant\\PennantClient;
use Pennant\\PennantException;

$pennant = new PennantClient(
    apiUrl: getenv('PENNANT_API_URL'),
    clientKey: getenv('PENNANT_CLIENT_KEY'),
    environment: 'production',
);

try {
    $flags = $pennant->evaluate(new EvaluationContext(userId: (string) $user->id));
} catch (PennantException $e) {
    $flags = null;
}
if ($flags?->isEnabled('${flag}')) {
    return newCheckout($request);
}`,
        notes: [
          keyNote,
          offNote,
          "Register the client once in your container (a Laravel singleton or a Symfony service) and evaluate per request.",
        ],
      }
    case "dotnet":
      return {
        sdk,
        install: "dotnet add package Pennant.Sdk",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `using Pennant;

// Program.cs: one client for the app.
builder.Services.AddSingleton(new PennantClient(new PennantClientOptions
{
    ApiUrl = builder.Configuration["PENNANT_API_URL"]!,
    ClientKey = builder.Configuration["PENNANT_CLIENT_KEY"]!,
    Environment = "production",
}));

// In a handler, evaluate with the request's user.
var flags = await pennant.EvaluateAsync(new EvaluationContext { UserId = user.Id }, ct);
if (flags.IsEnabled("${flag}"))
{
    return NewCheckout();
}`,
        notes: [
          keyNote,
          offNote,
          "Treat a PennantException as off, so an outage falls back to the current behaviour.",
        ],
      }
    case "flutter":
      return {
        sdk,
        install:
          "Add to pubspec.yaml: pennant_flutter: { git: { url: https://github.com/flypennant/pennant-sdks, path: flutter, ref: flutter/v1.1.0 } }",
        env: { PENNANT_API_URL: options.apiUrl, PENNANT_CLIENT_KEY: "<project client key>" },
        code: `import 'package:pennant_flutter/pennant_flutter.dart';

// flutter run --dart-define=PENNANT_API_URL=... --dart-define=PENNANT_CLIENT_KEY=...
final pennant = PennantClient(
  apiUrl: const String.fromEnvironment('PENNANT_API_URL'),
  clientKey: const String.fromEnvironment('PENNANT_CLIENT_KEY'),
  environment: 'production',
);

Widget build(BuildContext context) => PennantProvider(
      client: pennant,
      context: EvaluationContext(userId: user.id),
      child: const PennantFlag(
        name: '${flag}',
        fallback: ClassicCheckout(),
        child: NewCheckout(),
      ),
    );`,
        notes: [
          keyNote,
          offNote,
          "PennantProvider refreshes every 15 seconds by default. Set pollInterval to change it.",
          "Read flags in any widget below the provider with Pennant.of(context).isEnabled(key).",
        ],
      }
  }
}

export { MANIFESTS, SDKS, detectStack, readManifests, setupGuide }
export type { Detection, SdkId, SetupGuide }
