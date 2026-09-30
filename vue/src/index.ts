export { createPennantClient, getVariant, isEnabled } from "./client.ts"
export type {
  PennantClient,
  PennantClientOptions,
  PennantEnvironment,
  PennantEvaluationContext,
  PennantFlagMap,
} from "./client.ts"
export {
  Flag,
  PennantProvider,
  installPennant,
  pennantKey,
  useFlag,
  useFlags,
  usePennant,
  useVariant,
} from "./provider.ts"
export type { PennantProviderOptions, PennantValue } from "./provider.ts"
