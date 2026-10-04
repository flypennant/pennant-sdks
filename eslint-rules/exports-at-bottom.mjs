/**
 * Require exports at the bottom of .ts/.tsx modules.
 * Next.js route segment config must stay as a direct `export const`
 * because the compiler cannot parse a re-export of those names.
 */

const SEGMENT_CONFIG_NAMES = new Set([
  "dynamic",
  "dynamicParams",
  "revalidate",
  "fetchCache",
  "runtime",
  "preferredRegion",
  "maxDuration",
])

function isDirective(node) {
  return (
    node.type === "ExpressionStatement" &&
    node.expression.type === "Literal" &&
    (node.expression.value === "use client" || node.expression.value === "use server")
  )
}

function isImport(node) {
  return node.type === "ImportDeclaration"
}

function isExport(node) {
  return (
    node.type === "ExportNamedDeclaration" ||
    node.type === "ExportDefaultDeclaration" ||
    node.type === "ExportAllDeclaration"
  )
}

function isSegmentConfigExport(node) {
  if (node.type !== "ExportNamedDeclaration" || !node.declaration) return false
  if (node.declaration.type !== "VariableDeclaration") return false
  if (node.declaration.kind !== "const") return false
  if (node.declaration.declarations.length === 0) return false
  return node.declaration.declarations.every(
    (declarator) =>
      declarator.id.type === "Identifier" && SEGMENT_CONFIG_NAMES.has(declarator.id.name),
  )
}

function isExportSpecifierBlock(node) {
  if (node.type === "ExportAllDeclaration") return true
  if (node.type === "ExportDefaultDeclaration") {
    return node.declaration.type === "Identifier"
  }
  if (node.type === "ExportNamedDeclaration") {
    return node.declaration === null
  }
  return false
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Put every export at the bottom of the module. Next.js segment config may use a direct export const.",
    },
    schema: [],
    messages: {
      notAtBottom:
        "Keep exports at the bottom of the module. Declare the value first, then export it.",
      useSpecifier:
        "Declare this value or type first, then export it with `export { … }` or `export type { … }` at the bottom.",
      defaultIdentifier:
        "Declare the default export first, then use `export default Name` at the bottom.",
      afterExports:
        "Do not place declarations after the export block. Keep every export at the bottom.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename()
    if (!filename.endsWith(".ts") && !filename.endsWith(".tsx")) {
      return {}
    }
    // Skip declaration files. They are ambient surfaces.
    if (filename.endsWith(".d.ts")) {
      return {}
    }

    return {
      Program(program) {
        const body = program.body
        let lastCodeIndex = -1
        for (let i = 0; i < body.length; i++) {
          const node = body[i]
          if (isDirective(node) || isImport(node) || node.type === "EmptyStatement") continue
          if (isSegmentConfigExport(node)) continue
          if (isExport(node)) continue
          lastCodeIndex = i
        }

        let exportBlockStarted = false
        for (let i = 0; i < body.length; i++) {
          const node = body[i]
          if (isDirective(node) || isImport(node) || node.type === "EmptyStatement") continue
          if (isSegmentConfigExport(node)) continue

          if (isExport(node)) {
            if (i < lastCodeIndex) {
              context.report({ node, messageId: "notAtBottom" })
              continue
            }
            if (node.type === "ExportDefaultDeclaration") {
              if (node.declaration.type !== "Identifier") {
                context.report({ node, messageId: "defaultIdentifier" })
              }
            } else if (node.type === "ExportNamedDeclaration" && node.declaration !== null) {
              context.report({ node, messageId: "useSpecifier" })
            }
            exportBlockStarted = true
            continue
          }

          if (exportBlockStarted) {
            context.report({ node, messageId: "afterExports" })
          }
        }
      },
    }
  },
}

export default rule
