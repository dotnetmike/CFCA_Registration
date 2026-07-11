import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, jsonError } from "@/lib/auth/api"
import { hashPassword, verifyPassword } from "@/lib/auth/tokens"
import { createSession, getRequestMeta, revokeAllSessions } from "@/lib/auth/session"
import { applySessionCookies } from "@/lib/auth/cookies"
import { writeAuditLog } from "@/lib/audit/log"

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid password data")

  const admin = createAdminClient()
  const { data: user } = await admin
    .from("users")
    .select("password_hash")
    .eq("id", auth.sub)
    .maybeSingle()

  if (!user) return jsonError("User not found", 404)

  const valid = await verifyPassword(parsed.data.currentPassword, user.password_hash)
  if (!valid) {
    await writeAuditLog({
      userId: auth.sub,
      action: "auth.password_change_failed",
      metadata: { reason: "incorrect_current_password" },
      request,
    })
    return jsonError("Current password is incorrect", 400)
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await admin.from("users").update({ password_hash: passwordHash }).eq("id", auth.sub)
  await revokeAllSessions(auth.sub)

  await writeAuditLog({
    userId: auth.sub,
    action: "auth.password_change",
    previousValue: { password_hash: "[REDACTED]" },
    updatedValue: { password_hash: "[REDACTED]" },
    request,
  })

  const { accessToken, refreshToken, user: authUser } = await createSession(
    auth.sub,
    getRequestMeta(request)
  )

  const response = NextResponse.json({
    success: true,
    accessToken,
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      groups: authUser.groups,
      permissions: authUser.permissions,
    },
  })

  applySessionCookies(response, accessToken, refreshToken)
  return response
}
