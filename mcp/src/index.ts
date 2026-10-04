#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import { readConfig } from "./config.ts"
import { createConsoleClient } from "./console-client.ts"
import { registerTools } from "./tools.ts"

const INSTRUCTIONS = `Pennant is a self-hosted feature-flag console. Use these tools to read flags, explain why a flag is on or off for a user, change flags, and add a Pennant SDK to a codebase.

- To add Pennant to a codebase: call detect_stack, then sdk_setup, then edit the code so the new behaviour runs only when the flag is on.
- New flags start off everywhere. Prefer turning a flag on in development first.
- Production changes may need approval. When a tool says a change request was opened, tell the user an admin must approve it in the console.
- Never put a client key in source code. Use the environment variables sdk_setup lists.`

async function main() {
  const config = readConfig()
  if (typeof config === "string") {
    console.error(config)
    process.exit(1)
  }

  const server = new McpServer(
    { name: "pennant", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  )
  registerTools(server, createConsoleClient(config), config)
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
