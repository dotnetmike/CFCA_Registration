import { NextRequest, NextResponse } from "next/server"
import { refreshSession, getRequestMeta } from "@/lib/auth/session"
import { applySessionCookies, clearSessionCookies, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies"
import { jsonError } from "@/lib/auth/api"

export const POST = async (request: NextRequest) => {
  const refreshToken =
    request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ??
    (await request.json().catch(() => ({}))).refreshToken

  if (!refreshToken) return jsonError("No refresh token", 401)

  const session = await refreshSession(refreshToken, getRequestMeta(request))
  if (!session) {
    const response = jsonError("Invalid refresh token", 401)
    clearSessionCookies(response)
    return response
  }

  const response = NextResponse.json({
    accessToken: session.accessToken,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      groups: session.user.groups,
      permissions: session.user.permissions,
    },
  })

  applySessionCookies(response, session.accessToken, session.refreshToken)

  return response
}
