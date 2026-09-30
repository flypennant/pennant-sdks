import {
  computed,
  defineComponent,
  inject,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type PropType,
  type Ref,
  type SetupContext,
  type VNode,
} from "vue"

import {
  createPennantClient,
  type PennantClientOptions,
  type PennantEvaluationContext,
  type PennantFlagMap,
} from "./client.ts"

type PennantProviderOptions = PennantClientOptions & {
  pollIntervalMs?: number
}

type PennantValue = {
  flags: Ref<PennantFlagMap>
  loading: Ref<boolean>
  error: Ref<string | null>
  refetch: (context?: PennantEvaluationContext) => Promise<void>
}

const pennantKey: InjectionKey<PennantValue> = Symbol("pennant")

function createPennantState(options: PennantProviderOptions): PennantValue {
  const client = createPennantClient(options)
  const flags = ref<PennantFlagMap>({})
  const loading = ref(true)
  const error = ref<string | null>(null)
  let requestId = 0

  async function refetch(context = options.context): Promise<void> {
    const id = ++requestId
    try {
      const next = await client.evaluate(context)
      if (id !== requestId) return
      flags.value = next
      error.value = null
    } catch (caught) {
      if (id !== requestId) return
      error.value = caught instanceof Error ? caught.message : "Network error."
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  return { flags, loading, error, refetch }
}

function usePennant(): PennantValue {
  const value = inject(pennantKey)
  if (!value) {
    throw new Error("usePennant must be used within PennantProvider or after installPennant.")
  }
  return value
}

function useFlag(key: string): ComputedRef<boolean> {
  const { flags } = usePennant()
  return computed(() => flags.value[key]?.enabled ?? false)
}

function useVariant(key: string): ComputedRef<string | undefined> {
  const { flags } = usePennant()
  return computed(() => flags.value[key]?.variant)
}

function useFlags(): ComputedRef<PennantFlagMap> {
  const { flags } = usePennant()
  return computed(() => flags.value)
}

const PennantProvider = defineComponent({
  name: "PennantProvider",
  props: {
    apiUrl: { type: String, required: true },
    clientKey: { type: String, required: true },
    environment: { type: String, default: "development" },
    project: { type: String, required: false },
    context: {
      type: Object as PropType<PennantEvaluationContext>,
      required: false,
    },
    pollIntervalMs: { type: Number, default: 15000 },
  },
  setup(props, { slots }: SetupContext) {
    const state = createPennantState({
      apiUrl: props.apiUrl,
      clientKey: props.clientKey,
      environment: props.environment,
      project: props.project,
      context: props.context,
      pollIntervalMs: props.pollIntervalMs,
    })
    provide(pennantKey, state)

    let timer: ReturnType<typeof setInterval> | undefined

    onMounted(() => {
      void state.refetch()
      if (props.pollIntervalMs > 0) {
        timer = setInterval(() => {
          void state.refetch()
        }, props.pollIntervalMs)
      }
    })

    onUnmounted(() => {
      if (timer !== undefined) clearInterval(timer)
    })

    watch(
      () => [props.apiUrl, props.clientKey, props.environment, props.project, props.context],
      () => {
        void state.refetch(props.context)
      },
      { deep: true },
    )

    return (): VNode[] | undefined => slots.default?.()
  },
})

const Flag = defineComponent({
  name: "Flag",
  props: {
    name: { type: String, required: true },
  },
  setup(props, { slots }: SetupContext) {
    const enabled = useFlag(props.name)
    return (): VNode[] | undefined => {
      if (enabled.value) return slots.default?.()
      return slots.fallback?.()
    }
  },
})

function installPennant(
  app: { provide: (key: InjectionKey<PennantValue> | symbol, value: PennantValue) => void },
  options: PennantProviderOptions,
): PennantValue {
  const state = createPennantState(options)
  app.provide(pennantKey, state)
  void state.refetch()
  if ((options.pollIntervalMs ?? 15000) > 0) {
    setInterval(() => {
      void state.refetch()
    }, options.pollIntervalMs ?? 15000)
  }
  return state
}

export {
  Flag,
  PennantProvider,
  installPennant,
  pennantKey,
  useFlag,
  useFlags,
  usePennant,
  useVariant,
}
export type { PennantProviderOptions, PennantValue }
