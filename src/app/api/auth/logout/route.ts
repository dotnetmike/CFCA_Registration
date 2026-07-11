import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revokeRefreshToken } from "@/lib/auth/session"
import { clearSessionCookies, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies"
import { hashRefreshToken } from "@/lib/auth/tokens"
import { writeAuditLog } from "@/lib/audit/log"

export const POST = async (request: NextRequest) => {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value
  let userId: string | null = null

  if (refreshToken) {
    const admin = createAdminClient()
    const { data: tokenRow } = await admin
      .from("refresh_tokens")
      .select("user_id")
      .eq("token_hash", hashRefreshToken(refreshToken))
      .maybeSingle()

    userId = tokenRow?.user_id ?? null
    await revokeRefreshToken(refreshToken)
  }

  if (userId) {
    await writeAuditLog({
      userId,
      action: "auth.logout",
      request,
    })
  }

  const response = NextResponse.json({ success: true })
  clearSessionCookies(response)
  return response
}
