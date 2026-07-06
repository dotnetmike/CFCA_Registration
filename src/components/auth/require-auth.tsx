"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { isProtectedPath } from "@/lib/auth/paths"

const redirectToLogin = (pathname: string) => {
  const redirect = encodeURIComponent(pathname + window.location.search)
  window.location.assign(`/login?redirect=${redirect}`)
}

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth()
  const pathname = usePathname() ?? "/"
  const requiresAuth = isProtectedPath(pathname)

  useEffect(() => {
    if (!requiresAuth || isLoading) return
    if (!user) redirectToLogin(pathname)
  }, [user, isLoading, pathname, requiresAuth])

  if (!requiresAuth) return <>{children}</>

  if (isLoading) {
    return <p className="text-center text-gray-500">Loading...</p>
  }

  if (!user) {
    return <p className="text-center text-gray-500">Redirecting to login...</p>
  }

  return <>{children}</>
}
