import exportsAtBottom from "./eslint-rules/exports-at-bottom.mjs"

const plugin = {
  rules: {
    "exports-at-bottom": exportsAtBottom,
  },
}

export default plugin
