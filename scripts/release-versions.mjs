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
  readJsonVersion,
  readTomlVersion,
  updateCargoLock,
  updatePackageJson,
  updatePackageLock,
  updateTomlVersion,
}
