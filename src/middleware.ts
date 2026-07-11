import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyAccessToken } from "@/lib/auth/jwt"
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearSessionCookies,
} from "@/lib/auth/cookies"
import { isProtectedPath } from "@/lib/auth/paths"

const redirectToLogin = (request: NextRequest) => {
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
  const response = NextResponse.redirect(loginUrl)
  clearSessionCookies(response)
  return response
}

const copySetCookieHeaders = (source: Response, target: NextResponse) => {
  const setCookies = source.headers.getSetCookie()
  for (const cookie of setCookies) {
    target.headers.append("Set-Cookie", cookie)
  }
}

const trySilentRefresh = async (request: NextRequest): Promise<NextResponse | null> => {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (!refreshToken) return null

  const refreshUrl = new URL("/api/auth/refresh", request.url)
  const refreshRes = await fetch(refreshUrl, {
    method: "POST",
    headers: { Cookie: request.headers.get("cookie") ?? "" },
  })

  if (!refreshRes.ok) return null

  const response = NextResponse.next()
  copySetCookieHeaders(refreshRes, response)
  return response
}

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl
  if (!isProtectedPath(pathname)) return NextResponse.next()

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value
  if (accessToken) {
    const user = await verifyAccessToken(accessToken)
    if (user) return NextResponse.next()
  }

  const refreshed = await trySilentRefresh(request)
  if (refreshed) return refreshed

  return redirectToLogin(request)
}

export const config = {
  matcher: [
    "/my-registration/:path*",
    "/payment/:path*",
    "/dashboard/:path*",
    "/account/:path*",
  ],
}
