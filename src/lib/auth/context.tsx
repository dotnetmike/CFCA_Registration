"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

export type AuthUser = {
  id: string
  email: string
  name: string
  groups: string[]
  permissions: string[]
}

type AuthContextValue = {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<string | null>
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  getAuthHeaders: () => Record<string, string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const redirectToLogin = () => {
  if (typeof window === "undefined") return
  const path = window.location.pathname
  if (path === "/login" || path === "/signup") return
  const redirect = encodeURIComponent(path + window.location.search)
  window.location.assign(`/login?redirect=${redirect}`)
}

const sessionExpiredResponse = () =>
  new Response(JSON.stringify({ error: "Session expired" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const accessTokenRef = useRef<string | null>(null)
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null)

  const clearSession = () => {
    accessTokenRef.current = null
    setAccessToken(null)
    setUser(null)
  }

  const applySession = (data: { accessToken: string; user: AuthUser }, publish = true) => {
    accessTokenRef.current = data.accessToken
    if (!publish) return
    setAccessToken(data.accessToken)
    setUser(data.user)
  }

  const refreshSession = useCallback(async (publish = true): Promise<string | null> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    const promise = (async () => {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      if (!res.ok) {
        clearSession()
        return null
      }
      const data = await res.json()
      applySession(data, publish)
      return data.accessToken as string
    })().finally(() => {
      refreshPromiseRef.current = null
    })

    refreshPromiseRef.current = promise
    return promise
  }, [])

  const refresh = useCallback(() => refreshSession(true), [refreshSession])

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Rotate refresh cookie on every API call without re-rendering (avoids effect loops)
      await refreshSession(false)

      let token = accessTokenRef.current
      if (!token) {
        token = await refreshSession(true)
      }
      if (!token) {
        redirectToLogin()
        return sessionExpiredResponse()
      }

      const headers = new Headers(init?.headers)
      headers.set("Authorization", `Bearer ${token}`)

      let res = await fetch(input, { ...init, headers, credentials: "include" })

      if (res.status === 401) {
        const retryToken = (await refreshSession(false)) ?? (await refreshSession(true))
        if (!retryToken) {
          redirectToLogin()
          return sessionExpiredResponse()
        }

        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set("Authorization", `Bearer ${retryToken}`)
        res = await fetch(input, { ...init, headers: retryHeaders, credentials: "include" })

        if (res.status === 401) {
          clearSession()
          redirectToLogin()
          return sessionExpiredResponse()
        }
      }

      return res
    },
    [refreshSession]
  )

  useEffect(() => {
    const init = async () => {
      await refreshSession(true)
      setIsLoading(false)
    }
    init()
  }, [refreshSession])

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Login failed")
    }
    applySession(await res.json())
  }

  const signup = async (email: string, password: string, name: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password, name }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? "Signup failed")
    }
    applySession(await res.json())
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    clearSession()
  }

  const getAuthHeaders = (): Record<string, string> =>
    accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, login, signup, logout, refresh, authFetch, getAuthHeaders }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
