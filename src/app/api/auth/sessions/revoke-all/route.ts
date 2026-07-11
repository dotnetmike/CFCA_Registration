import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api"
import { revokeAllSessions } from "@/lib/auth/session"
import { clearSessionCookies } from "@/lib/auth/cookies"
import { writeAuditLog } from "@/lib/audit/log"

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const targetUserId = body.userId ?? auth.sub

  if (targetUserId !== auth.sub && !auth.permissions.includes("users:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await revokeAllSessions(targetUserId)

  await writeAuditLog({
    userId: auth.sub,
    action: "auth.session_revoke_all",
    metadata: { target_user_id: targetUserId },
    request,
  })

  const response = NextResponse.json({ success: true })
  if (targetUserId === auth.sub) {
    clearSessionCookies(response)
  }
  return response
}
