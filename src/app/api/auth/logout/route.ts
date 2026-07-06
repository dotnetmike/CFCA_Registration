import { NextRequest, NextResponse } from "next/server"
import { revokeRefreshToken } from "@/lib/auth/session"
import { clearSessionCookies, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies"

export const POST = async (request: NextRequest) => {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  if (refreshToken) await revokeRefreshToken(refreshToken)

  const response = NextResponse.json({ success: true })
  clearSessionCookies(response)
  return response
}
