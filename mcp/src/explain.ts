import type { Constraint, EvaluationContext, Flag, FlagResult, Segment, Strategy } from "./types.ts"

type Explanation = {
  /** null when only the server knows, which is a gradual rollout without a live result. */
  enabled: boolean | null
  reason: string
  /** Every rule that was checked, in the order the server checks them. */
  steps: string[]
}

function contextValue(context: EvaluationContext, name: string) {
  if (name === "userId") return context.userId
  if (name === "sessionId") return context.sessionId
  if (name === "remoteAddress") return context.remoteAddress
  if (name === "hostname") return context.hostname
  return context.properties?.[name]
}

function constraintPasses(constraint: Constraint, context: EvaluationContext) {
  const value = contextValue(context, constraint.contextName)
  if (constraint.operator === "IN") return value !== undefined && constraint.values.includes(value)
  return value === undefined || !constraint.values.includes(value)
}

function describeConstraint(constraint: Constraint) {
  const verb = constraint.operator === "IN" ? "is one of" : "is not one of"
  return `${constraint.contextName} ${verb} ${constraint.values.join(", ")}`
}

function describeStrategy(strategy: Strategy) {
  switch (strategy.type) {
    case "everyone":
      return "everyone"
    case "gradual":
      return `a ${strategy.percentage}% gradual rollout`
    case "allowlist":
      return `an allowlist of ${strategy.userIds.length} user id${strategy.userIds.length === 1 ? "" : "s"}`
    case "remoteAddress":
      return `an IP allowlist of ${strategy.addresses.length} address${strategy.addresses.length === 1 ? "" : "es"}`
    case "hostname":
      return `a hostname list (${strategy.hostnames.join(", ")})`
  }
}

/** Decides the strategy where it is knowable without the server's rollout bucket. */
function strategyResult(
  strategy: Strategy,
  context: EvaluationContext,
  live?: FlagResult,
): { on: boolean | null; why: string } {
  switch (strategy.type) {
    case "everyone":
      return { on: true, why: "The strategy is everyone." }
    case "gradual": {
      if (!context.userId)
        return { on: false, why: "Gradual rollouts need a userId, and the context has none." }
      if (strategy.percentage <= 0) return { on: false, why: "The rollout is at 0%." }
      if (strategy.percentage >= 100) return { on: true, why: "The rollout is at 100%." }
      if (live) {
        return {
          on: live.enabled,
          why: live.enabled
            ? `${context.userId} falls inside the ${strategy.percentage}% rollout.`
            : `${context.userId} falls outside the ${strategy.percentage}% rollout.`,
        }
      }
      return {
        on: null,
        why: `Whether ${context.userId} is inside the ${strategy.percentage}% rollout is decided by the server. Set PENNANT_CLIENT_KEY to check it live.`,
      }
    }
    case "allowlist": {
      const listed = Boolean(context.userId && strategy.userIds.includes(context.userId))
      return {
        on: listed,
        why: listed
          ? `${context.userId} is on the allowlist.`
          : "The userId is not on the allowlist.",
      }
    }
    case "remoteAddress": {
      const listed = Boolean(
        context.remoteAddress && strategy.addresses.includes(context.remoteAddress),
      )
      return {
        on: listed,
        why: listed
          ? "The remoteAddress is allowed."
          : "The remoteAddress is not in the allowed list.",
      }
    }
    case "hostname": {
      const listed = Boolean(context.hostname && strategy.hostnames.includes(context.hostname))
      return {
        on: listed,
        why: listed ? "The hostname is allowed." : "The hostname is not in the allowed list.",
      }
    }
  }
}

/**
 * Explains a flag for one context, in the same order the server evaluates:
 * archive, environment switch, constraints, segments, parent flag, strategy.
 * `live` holds evaluate results from the server, when a client key is configured.
 */
function explainFlag(
  flag: Flag,
  environment: string,
  context: EvaluationContext,
  lookups: {
    flags: Map<string, Flag>
    segments: Map<string, Segment>
    live?: Record<string, FlagResult>
  },
  visiting: Set<string> = new Set(),
): Explanation {
  const steps: string[] = []
  let parentUncertain = false
  const off = (reason: string): Explanation => ({
    enabled: false,
    reason,
    steps: [...steps, reason],
  })

  if (flag.archived) return off(`${flag.key} is archived, so it is never sent to apps.`)

  const config = flag.environments[environment]
  if (!config) return off(`${flag.key} has no settings for the ${environment} environment.`)
  if (!config.enabled) return off(`${flag.key} is switched off in ${environment}.`)
  steps.push(`${flag.key} is switched on in ${environment}.`)

  for (const constraint of config.constraints ?? []) {
    if (!constraintPasses(constraint, context)) {
      return off(`The constraint "${describeConstraint(constraint)}" does not match this context.`)
    }
    steps.push(`Constraint "${describeConstraint(constraint)}" matches.`)
  }

  for (const id of config.segmentIds ?? []) {
    const segment = lookups.segments.get(id)
    if (!segment) return off(`Segment ${id} no longer exists, so the flag stays off.`)
    const failed = segment.constraints.find((constraint) => !constraintPasses(constraint, context))
    if (failed)
      return off(
        `The context is not in segment "${segment.name}": ${describeConstraint(failed)} does not match.`,
      )
    steps.push(`The context is in segment "${segment.name}".`)
  }

  if (flag.parentKey) {
    if (visiting.has(flag.key)) return off("The parent chain loops back on itself.")
    const parent = lookups.flags.get(flag.parentKey)
    if (!parent) return off(`Parent flag ${flag.parentKey} does not exist.`)
    visiting.add(flag.key)
    const parentResult = explainFlag(parent, environment, context, lookups, visiting)
    visiting.delete(flag.key)
    if (parentResult.enabled === false) {
      return off(`Parent flag ${flag.parentKey} is off: ${parentResult.reason}`)
    }
    if (parentResult.enabled === null) {
      parentUncertain = true
      steps.push(`Parent flag ${flag.parentKey} depends on its rollout: ${parentResult.reason}`)
    } else {
      steps.push(`Parent flag ${flag.parentKey} is on.`)
    }
  }

  const strategy = strategyResult(config.strategy, context, lookups.live?.[flag.key])
  steps.push(`The strategy is ${describeStrategy(config.strategy)}. ${strategy.why}`)
  if (strategy.on === false) return { enabled: false, reason: strategy.why, steps }
  if (strategy.on === null) return { enabled: null, reason: strategy.why, steps }

  const live = lookups.live?.[flag.key]
  if (parentUncertain) {
    if (!live) {
      const reason = `${flag.key} passes its own rules, but its parent depends on a rollout the server decides.`
      return { enabled: null, reason, steps: [...steps, reason] }
    }
    if (!live.enabled) {
      const reason = `${flag.key} passes its own rules but is off, because its parent's rollout excludes this context.`
      return { enabled: false, reason, steps: [...steps, reason] }
    }
  }

  const variant = live?.variant
  const reason = variant
    ? `${flag.key} is on in ${environment} and returns variant "${variant}".`
    : `${flag.key} is on in ${environment}.`
  return { enabled: true, reason, steps: [...steps, reason] }
}

export { describeStrategy, explainFlag }
export type { Explanation }
