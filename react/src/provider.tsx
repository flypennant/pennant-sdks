"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type PennantEnvironment = "development" | "production"

export type PennantEvaluationContext = {
  userId?: string
  sessionId?: string
  properties?: Record<string, string>
}

export type PennantFlagMap = Record<string, { enabled: boolean }>

export type PennantProviderProps = {
  apiUrl: string
  clientKey: string
  environment?: PennantEnvironment
  /** Project id. Omitted requests evaluate the default project. */
  project?: string
  context?: PennantEvaluationContext
  pollIntervalMs?: number
  children: ReactNode
}

type PennantValue = {
  flags: PennantFlagMap
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const PennantContext = createContext<PennantValue | null>(null)

export function PennantProvider({
  apiUrl,
  clientKey,
  environment = "development",
  project,
  context,
  pollIntervalMs = 15000,
  children,
}: PennantProviderProps) {
  const [flags, setFlags] = useState<PennantFlagMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const contextKey = JSON.stringify(context ?? {})

  const refetch = useCallback(async () => {
    const id = ++requestId.current
    const base = apiUrl.replace(/\/$/, "")
    const parsedContext = JSON.parse(contextKey) as PennantEvaluationContext
    try {
      const response = await fetch(`${base}/api/client/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clientKey}`,
        },
        body: JSON.stringify({
          context: parsedContext,
          environment,
          ...(project ? { project } : {}),
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        error?: string
        flags?: PennantFlagMap
      } | null
      if (id !== requestId.current) return
      if (!response.ok) {
        setError(body?.error ?? `Evaluation failed (${response.status}).`)
        return
      }
      setFlags(body?.flags ?? {})
      setError(null)
    } catch (caught) {
      if (id !== requestId.current) return
      setError(caught instanceof Error ? caught.message : "Network error.")
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [apiUrl, clientKey, environment, project, contextKey])

  useEffect(() => {
    const timer =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            void refetch()
          }, pollIntervalMs)
        : undefined
    const kickoff = window.setTimeout(() => {
      void refetch()
    }, 0)
    return () => {
      window.clearTimeout(kickoff)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [pollIntervalMs, refetch])

  const value = useMemo<PennantValue>(
    () => ({
      flags,
      loading,
      error,
      refetch,
    }),
    [flags, loading, error, refetch],
  )

  return (
    <PennantContext.Provider value={value}>{children}</PennantContext.Provider>
  )
}

export function usePennant() {
  const value = useContext(PennantContext)
  if (!value) {
    throw new Error("usePennant must be used within PennantProvider.")
  }
  return value
}

export function useFlags(): PennantFlagMap {
  return usePennant().flags
}

export function useFlag(key: string): boolean {
  return usePennant().flags[key]?.enabled ?? false
}
