"use client"

import type { ReactNode } from "react"

import { useFlag } from "./provider"

function Flag({
  name,
  children,
  fallback = null,
}: {
  name: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const enabled = useFlag(name)
  return enabled ? children : fallback
}

export { Flag }
