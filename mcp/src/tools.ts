import path from "node:path"

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import type { McpConfig } from "./config.ts"
import { ConsoleError, type ConsoleClient } from "./console-client.ts"
import { describeStrategy, explainFlag } from "./explain.ts"
import { SDKS, detectStack, readManifests, setupGuide } from "./sdk-guide.ts"
import { FLAG_TYPES, type EnvironmentConfig, type Flag } from "./types.ts"

const projectArg = z
  .string()
  .optional()
  .describe("Project id. Defaults to PENNANT_PROJECT or 'default'.")

const strategySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("everyone") }),
  z.object({ type: z.literal("gradual"), percentage: z.number().int().min(0).max(100) }),
  z.object({ type: z.literal("allowlist"), userIds: z.array(z.string()) }),
  z.object({ type: z.literal("remoteAddress"), addresses: z.array(z.string()) }),
  z.object({ type: z.literal("hostname"), hostnames: z.array(z.string()) }),
])

const constraintSchema = z.object({
  contextName: z.string().describe("Context field, such as userId or a custom property like plan."),
  operator: z.enum(["IN", "NOT_IN"]),
  values: z.array(z.string()),
})

const contextSchema = z
  .object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    remoteAddress: z.string().optional(),
    hostname: z.string().optional(),
    properties: z.record(z.string(), z.string()).optional(),
  })
  .describe("Who the flag is evaluated for.")

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean }

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] }
}

function json(value: unknown): ToolResult {
  return ok(JSON.stringify(value, null, 2))
}

/** Turns console errors into tool errors the assistant can read and act on. */
async function guarded(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run()
  } catch (error) {
    const message =
      error instanceof ConsoleError
        ? `Pennant returned ${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unexpected error."
    return { content: [{ type: "text", text: message }], isError: true }
  }
}

function flagSummary(flag: Flag) {
  return {
    key: flag.key,
    name: flag.name,
    type: flag.type,
    archived: flag.archived,
    parentKey: flag.parentKey ?? null,
    tags: flag.tags,
    environments: Object.fromEntries(
      Object.entries(flag.environments).map(([env, config]) => [
        env,
        `${config.enabled ? "on" : "off"}, ${describeStrategy(config.strategy)}`,
      ]),
    ),
  }
}

function registerTools(server: McpServer, client: ConsoleClient, config: McpConfig) {
  const project = (value?: string) => value ?? config.project

  /* ---------- read ---------- */

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List the Pennant projects the signed-in user can open.",
      annotations: { readOnlyHint: true },
    },
    () => guarded(async () => json(await client.listProjects())),
  )

  server.registerTool(
    "list_environments",
    {
      title: "List environments",
      description: "List a project's environments, such as development and production.",
      inputSchema: { project: projectArg },
      annotations: { readOnlyHint: true },
    },
    (args) => guarded(async () => json(await client.listEnvironments(project(args.project)))),
  )

  server.registerTool(
    "list_flags",
    {
      title: "List flags",
      description:
        "List flags in a project with their type, tags, parent, and on/off state per environment.",
      inputSchema: {
        project: projectArg,
        includeArchived: z.boolean().optional(),
        tag: z.string().optional().describe("Only flags with this tag."),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const flags = await client.listFlags(project(args.project), args.includeArchived ?? false)
        const filtered = args.tag ? flags.filter((flag) => flag.tags.includes(args.tag!)) : flags
        return json(filtered.map(flagSummary))
      }),
  )

  server.registerTool(
    "get_flag",
    {
      title: "Get flag",
      description:
        "Get a flag's full configuration: strategy, constraints, segments, and variants per environment.",
      inputSchema: { key: z.string(), project: projectArg },
      annotations: { readOnlyHint: true },
    },
    (args) => guarded(async () => json(await client.getFlag(project(args.project), args.key))),
  )

  server.registerTool(
    "list_segments",
    {
      title: "List segments",
      description: "List a project's saved audiences and their constraints.",
      inputSchema: { project: projectArg },
      annotations: { readOnlyHint: true },
    },
    (args) => guarded(async () => json(await client.listSegments(project(args.project)))),
  )

  /* ---------- explain ---------- */

  server.registerTool(
    "explain_flag",
    {
      title: "Explain a flag result",
      description:
        "Explain why a flag is on or off for a given user in an environment. Walks the same rules the server checks: archive, environment switch, constraints, segments, parent flag, then strategy.",
      inputSchema: {
        key: z.string(),
        environment: z.string(),
        context: contextSchema,
        project: projectArg,
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const id = project(args.project)
        const [flags, segments, live] = await Promise.all([
          client.listFlags(id, true),
          client.listSegments(id),
          client.evaluate(args.environment, args.context, id),
        ])
        const flag = flags.find((item) => item.key === args.key)
        if (!flag)
          return {
            content: [{ type: "text", text: `No flag ${args.key} in project ${id}.` }],
            isError: true,
          }
        const explanation = explainFlag(flag, args.environment, args.context, {
          flags: new Map(flags.map((item) => [item.key, item])),
          segments: new Map(segments.map((item) => [item.id, item])),
          live: live ?? undefined,
        })
        const verdict =
          explanation.enabled === null
            ? "Depends on the rollout"
            : explanation.enabled
              ? "On"
              : "Off"
        const source = live
          ? "Confirmed against the live evaluate API."
          : "Worked out from the flag configuration."
        return ok(
          [
            `${verdict}: ${explanation.reason}`,
            "",
            ...explanation.steps.map((step, i) => `${i + 1}. ${step}`),
            "",
            source,
          ].join("\n"),
        )
      }),
  )

  /* ---------- sdk ---------- */

  server.registerTool(
    "detect_stack",
    {
      title: "Detect the codebase's stack",
      description:
        "Read the manifest files (package.json, pyproject.toml, go.mod, Cargo.toml) in a directory and say which Pennant SDK fits.",
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe("Directory to inspect. Defaults to the current directory."),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const dir = path.resolve(args.path ?? process.cwd())
        const detections = detectStack(await readManifests(dir))
        if (detections.length === 0) {
          return ok(
            `No package.json, pyproject.toml, requirements.txt, go.mod, or Cargo.toml in ${dir}. Run sdk_setup with the SDK you want.`,
          )
        }
        return json({
          directory: dir,
          matches: detections,
          next: "Call sdk_setup with the sdk (and framework) for install steps and code.",
        })
      }),
  )

  server.registerTool(
    "sdk_setup",
    {
      title: "SDK setup steps",
      description:
        "Install command, environment variables, and a first flag check for one Pennant SDK, pointed at this Pennant console.",
      inputSchema: {
        sdk: z.enum(SDKS),
        framework: z.enum(["next", "vite", "nuxt"]).optional(),
        flagKey: z
          .string()
          .optional()
          .describe("Flag to use in the example. Defaults to new-checkout."),
      },
      annotations: { readOnlyHint: true },
    },
    (args) =>
      guarded(async () => {
        const guide = setupGuide(args.sdk, {
          apiUrl: config.url,
          flagKey: args.flagKey,
          framework: args.framework,
        })
        const env = Object.entries(guide.env).map(([name, value]) => `${name}=${value}`)
        return ok(
          [
            `Install:\n${guide.install}`,
            `Environment:\n${env.join("\n")}`,
            `Code:\n${guide.code}`,
            `Notes:\n${guide.notes.map((note) => `- ${note}`).join("\n")}`,
          ].join("\n\n"),
        )
      }),
  )

  if (config.readOnly) return

  /* ---------- write ---------- */

  server.registerTool(
    "create_flag",
    {
      title: "Create flag",
      description: "Create a flag. It starts switched off in every environment.",
      inputSchema: {
        key: z.string().describe("Lowercase key used in code, such as new-checkout."),
        name: z.string(),
        description: z.string().optional(),
        type: z.enum(FLAG_TYPES).optional(),
        strategy: strategySchema.optional().describe("Starting strategy for every environment."),
        project: projectArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (args) =>
      guarded(async () => {
        const { project: id, ...input } = args
        const flag = await client.createFlag(project(id), input)
        return ok(
          `Created ${flag.key}. It is off everywhere until you switch it on.\n\n${JSON.stringify(flagSummary(flag), null, 2)}`,
        )
      }),
  )

  server.registerTool(
    "set_flag_enabled",
    {
      title: "Switch a flag on or off",
      description:
        "Switch a flag on or off in one environment. If the project requires approval for production, this opens a change request instead of applying the change.",
      inputSchema: {
        key: z.string(),
        environment: z.string(),
        enabled: z.boolean(),
        project: projectArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    (args) =>
      guarded(async () => {
        const result = await client.setEnabled(
          project(args.project),
          args.key,
          args.environment,
          args.enabled,
        )
        if (result.mode === "change-request") {
          return ok(
            `Production changes need approval in this project, so a change request was opened (${result.changeRequest.id}). An admin must approve it in the console.`,
          )
        }
        return ok(`${args.key} is now ${args.enabled ? "on" : "off"} in ${args.environment}.`)
      }),
  )

  server.registerTool(
    "update_targeting",
    {
      title: "Update targeting",
      description:
        "Change who gets a flag in one environment: strategy, constraints, variants, or segments. Production changes become a change request when the project requires approval.",
      inputSchema: {
        key: z.string(),
        environment: z.string(),
        strategy: strategySchema.optional(),
        constraints: z.array(constraintSchema).optional(),
        variants: z
          .array(z.object({ name: z.string(), weight: z.number().int().min(0) }))
          .optional(),
        segmentIds: z.array(z.string()).optional(),
        project: projectArg,
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (args) =>
      guarded(async () => {
        const id = project(args.project)
        const change: Partial<EnvironmentConfig> = {}
        if (args.strategy) change.strategy = args.strategy
        if (args.constraints) change.constraints = args.constraints
        if (args.variants) change.variants = args.variants
        if (args.segmentIds) change.segmentIds = args.segmentIds
        if (Object.keys(change).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Pass at least one of strategy, constraints, variants, or segmentIds.",
              },
            ],
            isError: true,
          }
        }

        if (args.environment === "production" && (await client.approvalRequired(id))) {
          const current = (await client.getFlag(id, args.key)).environments.production
          if (!current)
            return {
              content: [{ type: "text", text: `${args.key} has no production settings.` }],
              isError: true,
            }
          const { changeRequest } = await client.proposeProductionChange(id, args.key, {
            ...current,
            ...change,
          })
          return ok(
            `Production changes need approval in this project, so a change request was opened (${changeRequest.id}). An admin must approve it in the console.`,
          )
        }

        const flag = await client.updateFlag(id, args.key, {
          environments: { [args.environment]: change },
        })
        const config = flag.environments[args.environment]
        return ok(
          `Updated ${args.key} in ${args.environment}: ${config ? describeStrategy(config.strategy) : "saved"}.`,
        )
      }),
  )

  server.registerTool(
    "archive_flag",
    {
      title: "Archive or restore a flag",
      description:
        "Archive a flag so it stops being sent to apps, or restore it. Archived flags can always be restored.",
      inputSchema: { key: z.string(), archived: z.boolean().default(true), project: projectArg },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    (args) =>
      guarded(async () => {
        await client.updateFlag(project(args.project), args.key, { archived: args.archived })
        return ok(
          args.archived
            ? `Archived ${args.key}. Apps no longer receive it.`
            : `Restored ${args.key}.`,
        )
      }),
  )
}

export { registerTools }
