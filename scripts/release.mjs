import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  PACKAGES,
  latestVersion,
  planPackage,
  previousVersion,
  releaseCommitMessage,
  releaseNotes,
  textFromStdout,
  versionFromTag,
} from "./release-plan.mjs"
import {
  readJsonVersion,
  readTomlVersion,
  updateCargoLock,
  updatePackageJson,
  updatePackageLock,
  updateTomlVersion,
} from "./release-versions.mjs"

const root = path.resolve(import.meta.dirname, "..")

const FILES = {
  react: { packageJson: ["react/package.json"], lockPath: "react" },
  js: { packageJson: ["js/package.json"], lockPath: "js" },
  vue: { packageJson: ["vue/package.json"], lockPath: "vue" },
  node: { packageJson: ["node/package.json"], lockPath: "node" },
  python: { toml: ["python/pyproject.toml"] },
  go: {},
  rust: { toml: ["rust/Cargo.toml"], cargoLock: ["rust/Cargo.lock"] },
}

const NPM_SDKS = new Set(["react", "js", "vue", "node"])

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: options.stdio ?? "pipe",
  })
}

function git(args, options) {
  return textFromStdout(run("git", args, options))
}

function readTags() {
  const listed = git(["tag", "--list"])
  return listed ? listed.split("\n") : []
}

function readCommits(range) {
  const args = ["log", "--reverse", "--format=%H%x1f%s%x1f%b%x1e"]
  if (range) args.push(range)
  const raw = git(args)
  if (!raw) return []

  return raw
    .split("\x1e")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [hash, subject, body = ""] = block.split("\x1f")
      const listed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", "-m", hash])
      const files = listed ? [...new Set(listed.split("\n").filter(Boolean))] : []
      const message = body.trim() ? `${subject}\n\n${body.trim()}` : subject
      return { hash, message, files }
    })
}

function readCommitsSince(tag) {
  return readCommits(tag ? `${tag}..HEAD` : undefined)
}

function readManifestVersion(pkg) {
  const files = FILES[pkg.id]
  const packageJson = files.packageJson?.[0]
  if (packageJson) return readJsonVersion(fs.readFileSync(path.join(root, packageJson), "utf8"))
  const toml = files.toml?.[0]
  if (toml) return readTomlVersion(fs.readFileSync(path.join(root, toml), "utf8"))
  return pkg.fallbackVersion
}

function writeText(file, text) {
  fs.writeFileSync(path.join(root, file), text)
}

function readText(file) {
  return fs.readFileSync(path.join(root, file), "utf8")
}

function applyVersions(plans) {
  const lock = { packages: {} }

  for (const plan of plans) {
    if (plan.initial) continue
    const files = FILES[plan.id]
    for (const file of files.packageJson ?? []) {
      writeText(file, updatePackageJson(readText(file), plan.version))
    }
    for (const file of files.toml ?? []) {
      writeText(file, updateTomlVersion(readText(file), plan.version))
    }
    for (const file of files.cargoLock ?? []) {
      writeText(file, updateCargoLock(readText(file), plan.version))
    }
    if (files.lockPath) lock.packages[files.lockPath] = plan.version
  }

  if (Object.keys(lock.packages).length === 0) return
  writeText("package-lock.json", updatePackageLock(readText("package-lock.json"), lock))
}

function commitVersions(plans) {
  const files = plans.flatMap((plan) => {
    if (plan.initial) return []
    const entry = FILES[plan.id]
    return [
      ...(entry.packageJson ?? []),
      ...(entry.toml ?? []),
      ...(entry.cargoLock ?? []),
      ...(entry.lockPath ? ["package-lock.json"] : []),
    ]
  })
  const unique = [...new Set(files)]
  if (unique.length === 0) return false
  git(["add", "--", ...unique])
  const staged = git(["diff", "--cached", "--name-only"])
  if (!staged) return false

  const author = {
    GIT_AUTHOR_NAME: "github-actions[bot]",
    GIT_AUTHOR_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
    GIT_COMMITTER_NAME: "github-actions[bot]",
    GIT_COMMITTER_EMAIL: "41898282+github-actions[bot]@users.noreply.github.com",
  }
  run("git", ["commit", "--no-verify", "-m", releaseCommitMessage(plans)], {
    env: author,
    stdio: "inherit",
  })
  return true
}

function releaseExists(tag) {
  try {
    run("gh", ["release", "view", tag], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function writeNotes(plan, fileName) {
  const notesPath = path.join(os.tmpdir(), fileName)
  fs.writeFileSync(notesPath, releaseNotes(plan))
  return notesPath
}

function packSdkTarball(id) {
  const dest = os.tmpdir()
  const printed = textFromStdout(
    run("npm", ["pack", "--pack-destination", dest], { cwd: path.join(root, id) }),
  )
  const name = printed.split("\n").filter(Boolean).at(-1)
  if (!name) throw new Error(`npm pack produced no tarball for ${id}`)
  return path.join(dest, name)
}

function uploadSdkTarball(id, tag) {
  if (!NPM_SDKS.has(id)) return
  const tarball = packSdkTarball(id)
  run("gh", ["release", "upload", tag, tarball, "--clobber"], { stdio: "inherit" })
}

function npmHasVersion(id, version) {
  const { name } = JSON.parse(readText(`${id}/package.json`))
  try {
    return textFromStdout(run("npm", ["view", `${name}@${version}`, "version"])) === version
  } catch {
    return false
  }
}

function publishNpm(plan) {
  if (!NPM_SDKS.has(plan.id) || !process.env.NODE_AUTH_TOKEN) return
  if (npmHasVersion(plan.id, plan.version)) {
    console.log(`npm already has ${plan.id} ${plan.version}`)
    return
  }
  run("npm", ["publish", "--access", "public", "--provenance"], {
    cwd: path.join(root, plan.id),
    stdio: "inherit",
  })
}

function publishPypi(plan) {
  if (plan.id !== "python" || !process.env.PYPI_TOKEN) return
  const cwd = path.join(root, "python")
  fs.rmSync(path.join(cwd, "dist"), { recursive: true, force: true })
  run("python3", ["-m", "build"], { cwd, stdio: "inherit" })
  run("python3", ["-m", "twine", "upload", "--skip-existing", "--non-interactive", "dist/*"], {
    cwd,
    env: { TWINE_USERNAME: "__token__", TWINE_PASSWORD: process.env.PYPI_TOKEN },
    stdio: "inherit",
  })
}

function publishCrate(plan) {
  if (plan.id !== "rust" || !process.env.CARGO_REGISTRY_TOKEN) return
  run("cargo", ["publish", "--locked"], { cwd: path.join(root, "rust"), stdio: "inherit" })
}

function publishRelease(plan) {
  const notesPath = writeNotes(plan, `pennant-sdk-release-${plan.id}.md`)
  const tags = new Set(readTags())
  if (!tags.has(plan.tag)) git(["tag", plan.tag])
  run("git", ["push", "origin", `refs/tags/${plan.tag}`], { stdio: "inherit" })
  if (!releaseExists(plan.tag)) {
    run("gh", ["release", "create", plan.tag, "--title", plan.tag, "--notes-file", notesPath], {
      stdio: "inherit",
    })
  }
  uploadSdkTarball(plan.id, plan.tag)
  publishNpm(plan)
  publishPypi(plan)
  publishCrate(plan)
}

function notesForExistingTag(pkg, tag, tags) {
  const version = versionFromTag(tag, pkg.tagPrefix)
  const previous = previousVersion(tags, pkg.tagPrefix, version)
  const commits = readCommits(previous ? `${pkg.tagPrefix}${previous}..${tag}` : tag)
  const plan = planPackage({ ...pkg, version }, { latest: previous, commits })
  if (plan) return releaseNotes(plan)
  return releaseNotes({ initial: previous === null, commits: [] })
}

function publishMissingReleases(tags) {
  for (const pkg of PACKAGES) {
    for (const tag of tags) {
      if (!versionFromTag(tag, pkg.tagPrefix)) continue
      if (releaseExists(tag)) continue
      const notesPath = path.join(os.tmpdir(), `pennant-sdk-existing-${pkg.id}.md`)
      fs.writeFileSync(notesPath, notesForExistingTag(pkg, tag, tags))
      console.log(`GitHub release for existing tag ${tag}`)
      run("gh", ["release", "create", tag, "--title", tag, "--notes-file", notesPath], {
        stdio: "inherit",
      })
      uploadSdkTarball(pkg.id, tag)
    }
  }
}

function main() {
  const publish =
    (process.env.GITHUB_ACTIONS === "true" || process.env.RELEASE_PUBLISH === "1") &&
    !process.argv.includes("--dry-run")
  const tags = readTags()
  const plans = PACKAGES.flatMap((pkg) => {
    const latest = latestVersion(tags, pkg.tagPrefix)
    const latestTag = latest ? `${pkg.tagPrefix}${latest}` : null
    const plan = planPackage(
      { ...pkg, version: readManifestVersion(pkg) },
      { latest, commits: readCommitsSince(latestTag) },
    )
    return plan ? [plan] : []
  })

  for (const plan of plans) {
    const reason = plan.initial ? "initial" : plan.level
    console.log(`${plan.tag} (${reason})`)
  }

  if (plans.length === 0) console.log("No new version. SDK tags already match main.")

  if (!publish) {
    console.log("Dry run. GitHub Actions publishes this on push to main.")
    return
  }

  if (plans.length > 0) {
    applyVersions(plans)
    if (commitVersions(plans)) {
      run("git", ["push", "origin", "HEAD:main"], { stdio: "inherit" })
    }
    for (const plan of plans) publishRelease(plan)
  }

  publishMissingReleases(readTags())
}

main()
