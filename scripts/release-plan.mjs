const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

const SDK_IDS = [
  "react",
  "js",
  "vue",
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
  "mcp",
]

// Tag prefixes match the folder. Go resolves `go/vX.Y.Z` for the module in go/.
const PACKAGES = SDK_IDS.map((id) => ({
  id,
  tagPrefix: `${id}/v`,
  pathPrefix: `${id}/`,
  fallbackVersion: "1.1.0",
}))

function parseSemver(version) {
  const match = SEMVER.exec(version)
  if (!match) {
    throw new Error(`version must be MAJOR.MINOR.PATCH, got ${version}`)
  }
  return match.slice(1).map(Number)
}

function compareSemver(left, right) {
  const a = parseSemver(left)
  const b = parseSemver(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function bumpVersion(version, level) {
  const [major, minor, patch] = parseSemver(version)
  if (level === "major") return `${major + 1}.0.0`
  if (level === "minor") return `${major}.${minor + 1}.0`
  if (level === "patch") return `${major}.${minor}.${patch + 1}`
  throw new Error(`unknown bump level ${level}`)
}

function versionFromTag(tag, tagPrefix) {
  if (!tag.startsWith(tagPrefix)) return null
  const version = tag.slice(tagPrefix.length)
  return SEMVER.test(version) ? version : null
}

function previousVersion(tags, tagPrefix, version) {
  let best = null
  for (const tag of tags) {
    const candidate = versionFromTag(tag, tagPrefix)
    if (!candidate || compareSemver(candidate, version) >= 0) continue
    if (!best || compareSemver(candidate, best) > 0) best = candidate
  }
  return best
}

function textFromStdout(stdout) {
  return typeof stdout === "string" ? stdout.trim() : ""
}

function latestVersion(tags, tagPrefix) {
  let best = null
  for (const tag of tags) {
    const version = versionFromTag(tag, tagPrefix)
    if (!version) continue
    if (!best || compareSemver(version, best) > 0) best = version
  }
  return best
}

function parseConventionalCommit(message) {
  const subject = message.split("\n")[0].trim()
  const match = /^(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/.exec(subject)
  if (!match) return null
  const [, type, scope, bang, description] = match
  const breaking = Boolean(bang) || /^BREAKING[ -]CHANGE\s*:/m.test(message)
  return {
    type,
    scope: scope ?? null,
    breaking,
    description,
  }
}

function isReleaseCommit(commit) {
  return commit.message.split("\n")[0].startsWith("chore(release):")
}

function normalizePath(file) {
  return file.replaceAll("\\", "/")
}

function touchesPrefix(files, pathPrefix) {
  const directory = pathPrefix.slice(0, -1)
  return files.some((file) => {
    const normalized = normalizePath(file)
    return normalized === directory || normalized.startsWith(pathPrefix)
  })
}

function levelFromCommits(commits) {
  let level = "patch"
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message)
    if (!parsed) continue
    if (parsed.breaking) return "major"
    if (parsed.type === "feat") level = "minor"
  }
  return level
}

function planPackage(pkg, { latest, commits }) {
  const work = commits.filter((commit) => !isReleaseCommit(commit))
  const touching = work.filter((commit) => touchesPrefix(commit.files, pkg.pathPrefix))
  if (!latest) {
    return {
      id: pkg.id,
      tagPrefix: pkg.tagPrefix,
      tag: `${pkg.tagPrefix}${pkg.version}`,
      version: pkg.version,
      previous: null,
      initial: true,
      level: null,
      commits: touching,
    }
  }

  if (touching.length === 0) return null

  const level = levelFromCommits(touching)
  const promoted = parseSemver(latest)[0] === 0
  const version = promoted ? "1.0.0" : bumpVersion(latest, level)

  return {
    id: pkg.id,
    tagPrefix: pkg.tagPrefix,
    tag: `${pkg.tagPrefix}${version}`,
    version,
    previous: latest,
    initial: false,
    level: promoted ? "major" : level,
    commits: touching,
  }
}

function planReleases({ packages, tags, commitsById }) {
  return packages.flatMap((pkg) => {
    const latest = latestVersion(tags, pkg.tagPrefix)
    const plan = planPackage(pkg, {
      latest,
      commits: commitsById[pkg.id] ?? [],
    })
    return plan ? [plan] : []
  })
}

function releaseNotes(plan) {
  const lines = []
  if (plan.initial) lines.push("Initial release.")

  const groups = {
    breaking: [],
    feat: [],
    fix: [],
    other: [],
  }

  for (const commit of [...plan.commits].reverse()) {
    const parsed = parseConventionalCommit(commit.message)
    const subject = parsed ? parsed.description : commit.message.split("\n")[0]
    const line = `- ${subject} (${commit.hash.slice(0, 7)})`
    if (parsed?.breaking) groups.breaking.push(line)
    else if (parsed?.type === "feat") groups.feat.push(line)
    else if (parsed?.type === "fix") groups.fix.push(line)
    else groups.other.push(line)
  }

  const sections = [
    ["Breaking changes", groups.breaking],
    ["Features", groups.feat],
    ["Bug fixes", groups.fix],
    ["Other changes", groups.other],
  ]
  for (const [title, entries] of sections) {
    if (entries.length === 0) continue
    if (lines.length > 0) lines.push("")
    lines.push(`## ${title}`, ...entries)
  }

  if (lines.length === 0) lines.push("Patch release.")
  return `${lines.join("\n")}\n`
}

function releaseCommitMessage(plans) {
  const tags = plans.map((plan) => plan.tag)
  const subject =
    tags.length === 1
      ? `chore(release): ${tags[0]} [skip ci]`
      : `chore(release): ${tags.length} packages [skip ci]`
  return `${subject}\n\n${tags.map((tag) => `- ${tag}`).join("\n")}\n`
}

export {
  PACKAGES,
  bumpVersion,
  compareSemver,
  isReleaseCommit,
  latestVersion,
  parseConventionalCommit,
  planPackage,
  planReleases,
  previousVersion,
  releaseCommitMessage,
  releaseNotes,
  textFromStdout,
  versionFromTag,
}
