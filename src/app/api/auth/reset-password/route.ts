import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/auth/api"
import { hashPassword } from "@/lib/auth/tokens"
import { revokeAllSessions } from "@/lib/auth/session"
import {
  markPasswordResetTokenUsed,
  verifyPasswordResetToken,
} from "@/lib/auth/password-reset"
import { writeAuditLog } from "@/lib/audit/log"

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid reset data")

  const tokenRow = await verifyPasswordResetToken(parsed.data.token)
  if (!tokenRow) return jsonError("Invalid or expired reset link", 400)

  const passwordHash = await hashPassword(parsed.data.newPassword)
  const admin = createAdminClient()

  await admin
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", tokenRow.user_id)

  await markPasswordResetTokenUsed(tokenRow.id)
  await revokeAllSessions(tokenRow.user_id)

  await writeAuditLog({
    userId: tokenRow.user_id,
    action: "auth.password_reset_complete",
    previousValue: { password_hash: "[REDACTED]" },
    updatedValue: { password_hash: "[REDACTED]" },
    request,
  })

  return NextResponse.json({ success: true })
}
