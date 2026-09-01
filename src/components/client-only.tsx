"use client"

import type { ReactNode } from "react"
import { useClientMounted } from "@/hooks/use-client-mounted"

type ClientOnlyProps = {
  children: ReactNode
  fallback?: ReactNode
}

/** Renders children only after mount so password-manager extensions cannot break hydration. */
export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  const mounted = useClientMounted()

  if (!mounted) return <>{fallback}</>

  return <>{children}</>
}
