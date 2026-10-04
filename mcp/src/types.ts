/** Shapes returned by the Pennant console API. Mirrors the console's own types. */

type Strategy =
  | { type: "everyone" }
  | { type: "gradual"; percentage: number }
  | { type: "allowlist"; userIds: string[] }
  | { type: "remoteAddress"; addresses: string[] }
  | { type: "hostname"; hostnames: string[] }

type Constraint = {
  contextName: string
  operator: "IN" | "NOT_IN"
  values: string[]
}

type Variant = { name: string; weight: number }

type EnvironmentConfig = {
  enabled: boolean
  strategy: Strategy
  constraints?: Constraint[]
  variants?: Variant[]
  segmentIds?: string[]
}

const FLAG_TYPES = ["release", "experiment", "operational", "kill-switch", "permission"] as const

type FlagType = (typeof FLAG_TYPES)[number]

type Flag = {
  key: string
  name: string
  description: string
  type: FlagType
  parentKey?: string | null
  tags: string[]
  archived: boolean
  impressionCounts?: Record<string, number>
  environments: Record<string, EnvironmentConfig>
}

type Segment = {
  id: string
  name: string
  description: string
  constraints: Constraint[]
}

type ProjectSummary = { id: string; name: string; description?: string }

type EvaluationContext = {
  userId?: string
  sessionId?: string
  remoteAddress?: string
  hostname?: string
  properties?: Record<string, string>
}

type FlagResult = { enabled: boolean; variant?: string }

export { FLAG_TYPES }
export type {
  Constraint,
  EnvironmentConfig,
  EvaluationContext,
  Flag,
  FlagResult,
  FlagType,
  ProjectSummary,
  Segment,
  Strategy,
  Variant,
}
