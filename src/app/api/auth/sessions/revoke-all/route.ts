import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api"
import { revokeAllSessions } from "@/lib/auth/session"
import { REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies"

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const targetUserId = body.userId ?? auth.sub

  if (targetUserId !== auth.sub && !auth.permissions.includes("users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await revokeAllSessions(targetUserId)

  const response = NextResponse.json({ success: true })
  if (targetUserId === auth.sub) {
    response.cookies.delete(REFRESH_TOKEN_COOKIE)
  }
  return response
}
