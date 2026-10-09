function updatePackageJson(text, version) {
  const data = JSON.parse(text)
  data.version = version
  return `${JSON.stringify(data, null, 2)}\n`
}

function updatePackageLock(text, { packages }) {
  const data = JSON.parse(text)
  for (const [directory, version] of Object.entries(packages ?? {})) {
    const entry = data.packages[directory]
    if (!entry) throw new Error(`lockfile has no ${directory} package`)
    entry.version = version
  }
  return `${JSON.stringify(data, null, 2)}\n`
}

function updateTomlVersion(text, version) {
  const next = text.replace(/version = "[0-9]+\.[0-9]+\.[0-9]+"/, `version = "${version}"`)
  if (next === text) throw new Error("version assignment not found")
  return next
}

function updatePomVersion(text, version) {
  const next = text.replace(
    /(<artifactId>pennant-sdk<\/artifactId>\s*<version>)[0-9]+\.[0-9]+\.[0-9]+(<\/version>)/,
    `$1${version}$2`,
  )
  if (next === text) throw new Error("pom project version not found")
  return next
}

function updateGradleVersion(text, version) {
  const next = text.replace(/^version = "[0-9]+\.[0-9]+\.[0-9]+"$/m, `version = "${version}"`)
  if (next === text) throw new Error("gradle version assignment not found")
  return next
}

function readPomVersion(text) {
  const match =
    /<artifactId>pennant-sdk<\/artifactId>\s*<version>([0-9]+\.[0-9]+\.[0-9]+)<\/version>/.exec(
      text,
    )
  if (!match) throw new Error("pom project version not found")
  return match[1]
}

function readGradleVersion(text) {
  const match = /^version = "([0-9]+\.[0-9]+\.[0-9]+)"$/m.exec(text)
  if (!match) throw new Error("gradle version assignment not found")
  return match[1]
}

function updateCsprojVersion(text, version) {
  const next = text.replace(
    /<Version>[0-9]+\.[0-9]+\.[0-9]+<\/Version>/,
    `<Version>${version}</Version>`,
  )
  if (next === text) throw new Error("csproj <Version> not found")
  return next
}

function readCsprojVersion(text) {
  const match = /<Version>([0-9]+\.[0-9]+\.[0-9]+)<\/Version>/.exec(text)
  if (!match) throw new Error("csproj <Version> not found")
  return match[1]
}

function updatePubspecVersion(text, version) {
  const next = text.replace(/^version: [0-9]+\.[0-9]+\.[0-9]+$/m, `version: ${version}`)
  if (next === text) throw new Error("pubspec version not found")
  return next
}

function readPubspecVersion(text) {
  const match = /^version: ([0-9]+\.[0-9]+\.[0-9]+)$/m.exec(text)
  if (!match) throw new Error("pubspec version not found")
  return match[1]
}

function updateCargoLock(text, version) {
  const pattern = /(name = "pennant-sdk"\nversion = ")[0-9]+\.[0-9]+\.[0-9]+(")/
  const next = text.replace(pattern, `$1${version}$2`)
  if (next === text) throw new Error("Cargo.lock is missing the pennant-sdk package version")
  return next
}

function readJsonVersion(text) {
  return JSON.parse(text).version
}

function readTomlVersion(text) {
  const match = /version = "([0-9]+\.[0-9]+\.[0-9]+)"/.exec(text)
  if (!match) throw new Error("version assignment not found")
  return match[1]
}

export {
  readCsprojVersion,
  readGradleVersion,
  readJsonVersion,
  readPomVersion,
  readPubspecVersion,
  readTomlVersion,
  updateCargoLock,
  updateCsprojVersion,
  updateGradleVersion,
  updatePackageJson,
  updatePackageLock,
  updatePomVersion,
  updatePubspecVersion,
  updateTomlVersion,
}
