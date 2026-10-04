import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import type { McpConfig } from "./config.ts"
import type { ConsoleClient } from "./console-client.ts"
import { registerTools } from "./tools.ts"
import type { Flag } from "./types.ts"

const FLAG: Flag = {
  key: "new-checkout",
  name: "New checkout",
  description: "",
  type: "release",
  tags: ["checkout"],
  archived: false,
  environments: {
    development: { enabled: true, strategy: { type: "everyone" } },
    production: { enabled: false, strategy: { type: "everyone" } },
  },
}

function stubClient(overrides: Partial<ConsoleClient> = {}) {
  const calls: string[] = []
  const client = {
    hasClientKey: false,
    evaluate: async () => null,
    listProjects: async () => [{ id: "default", name: "Default" }],
    listEnvironments: async () => ["development", "production"],
    listFlags: async () => [FLAG],
    getFlag: async () => FLAG,
    listSegments: async () => [],
    createFlag: async (_project: string, input: { key: string; name: string }) => ({
      ...FLAG,
      ...input,
    }),
    updateFlag: async () => FLAG,
    setEnabled: async (_p: string, key: string, environment: string) => {
      calls.push(`toggle ${key} ${environment}`)
      return environment === "production"
        ? {
            mode: "change-request" as const,
            changeRequest: { id: "cr-1", flagKey: key, environment, status: "pending" },
            flag: FLAG,
          }
        : { mode: "direct" as const, flag: FLAG }
    },
    approvalRequired: async () => true,
    proposeProductionChange: async (_p: string, flagKey: string) => {
      calls.push(`propose ${flagKey}`)
      return {
        changeRequest: { id: "cr-2", flagKey, environment: "production", status: "pending" },
      }
    },
    ...overrides,
  } as ConsoleClient
  return { client, calls }
}

const CONFIG: McpConfig = {
  url: "https://flags.example.com",
  email: "a",
  password: "b",
  project: "default",
  readOnly: false,
}

async function connect(client: ConsoleClient, config: McpConfig = CONFIG) {
  const server = new McpServer({ name: "pennant", version: "test" })
  registerTools(server, client, config)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const mcp = new Client({ name: "test", version: "1" })
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)])
  return mcp
}

function text(result: Awaited<ReturnType<Client["callTool"]>>) {
  return (result.content as { text: string }[]).map((part) => part.text).join("\n")
}

describe("MCP tools", () => {
  it("lists read, explain, write, and SDK tools", async () => {
    const mcp = await connect(stubClient().client)
    const names = (await mcp.listTools()).tools.map((tool) => tool.name).sort()
    assert.deepEqual(names, [
      "archive_flag",
      "create_flag",
      "detect_stack",
      "explain_flag",
      "get_flag",
      "list_environments",
      "list_flags",
      "list_projects",
      "list_segments",
      "sdk_setup",
      "set_flag_enabled",
      "update_targeting",
    ])
  })

  it("leaves out write tools in read-only mode", async () => {
    const mcp = await connect(stubClient().client, { ...CONFIG, readOnly: true })
    const names = (await mcp.listTools()).tools.map((tool) => tool.name)
    assert.ok(!names.includes("create_flag"))
    assert.ok(!names.includes("set_flag_enabled"))
    assert.ok(names.includes("explain_flag"))
  })

  it("summarises flags per environment", async () => {
    const mcp = await connect(stubClient().client)
    const result = await mcp.callTool({ name: "list_flags", arguments: {} })
    assert.match(text(result), /"production": "off, everyone"/)
  })

  it("explains a result step by step", async () => {
    const mcp = await connect(stubClient().client)
    const result = await mcp.callTool({
      name: "explain_flag",
      arguments: { key: "new-checkout", environment: "production", context: { userId: "u1" } },
    })
    assert.match(text(result), /^Off: new-checkout is switched off in production/)
  })

  it("reports a change request when production needs approval", async () => {
    const { client, calls } = stubClient()
    const mcp = await connect(client)
    const toggle = await mcp.callTool({
      name: "set_flag_enabled",
      arguments: { key: "new-checkout", environment: "production", enabled: true },
    })
    assert.match(text(toggle), /change request was opened \(cr-1\)/)
    const targeting = await mcp.callTool({
      name: "update_targeting",
      arguments: {
        key: "new-checkout",
        environment: "production",
        strategy: { type: "gradual", percentage: 10 },
      },
    })
    assert.match(text(targeting), /cr-2/)
    assert.deepEqual(calls, ["toggle new-checkout production", "propose new-checkout"])
  })

  it("returns console errors as tool errors", async () => {
    const { ConsoleError } = await import("./console-client.ts")
    const mcp = await connect(
      stubClient({
        getFlag: async () => {
          throw new ConsoleError(403, "You do not have access to that project.")
        },
      }).client,
    )
    const result = await mcp.callTool({ name: "get_flag", arguments: { key: "x" } })
    assert.equal(result.isError, true)
    assert.match(text(result), /403: You do not have access/)
  })

  it("gives SDK setup steps pointed at the console", async () => {
    const mcp = await connect(stubClient().client)
    const result = await mcp.callTool({
      name: "sdk_setup",
      arguments: { sdk: "react", framework: "next" },
    })
    assert.match(text(result), /npm install @pennant\/react/)
    assert.match(text(result), /https:\/\/flags\.example\.com/)
    assert.match(text(result), /NEXT_PUBLIC_PENNANT_CLIENT_KEY/)
  })
})
