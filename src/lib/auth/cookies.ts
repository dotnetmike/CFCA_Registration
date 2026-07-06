import { decodeJwt } from "jose"
import { NextResponse } from "next/server"

export const ACCESS_TOKEN_COOKIE = "cfca_access_token"
export const REFRESH_TOKEN_COOKIE = "cfca_refresh_token"

const DEFAULT_ACCESS_MAX_AGE = 60 * 60 * 6

export const getRefreshCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeSeconds,
})

export const getAccessCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: maxAgeSeconds,
})

export const getAccessTokenMaxAge = (accessToken: string): number => {
  try {
    const payload = decodeJwt(accessToken)
    if (payload.exp) {
      const ttl = payload.exp - Math.floor(Date.now() / 1000)
      return Math.max(ttl, 0)
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_ACCESS_MAX_AGE
}

export const applySessionCookies = (
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) => {
  response.cookies.set(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    getAccessCookieOptions(getAccessTokenMaxAge(accessToken))
  )
  response.cookies.set(
    REFRESH_TOKEN_COOKIE,
    refreshToken,
    getRefreshCookieOptions(60 * 60 * 24 * 30)
  )
}

export const clearSessionCookies = (response: NextResponse) => {
  response.cookies.delete(ACCESS_TOKEN_COOKIE)
  response.cookies.delete(REFRESH_TOKEN_COOKIE)
}
