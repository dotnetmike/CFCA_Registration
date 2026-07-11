import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/auth/api"
import { normalizeEmail } from "@/lib/utils"
import { createPasswordResetToken } from "@/lib/auth/password-reset"
import { sendPasswordResetEmail } from "@/lib/email/password-reset"
import { getSiteUrl } from "@/lib/site-url"
import { writeAuditLog } from "@/lib/audit/log"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent."

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) return jsonError("Please enter a valid email address")

  const email = normalizeEmail(parsed.data.email)
  const admin = createAdminClient()

  const { data: user } = await admin
    .from("users")
    .select("id, email, name, is_active")
    .eq("email", email)
    .maybeSingle()

  if (!user?.is_active) {
    await writeAuditLog({
      action: "auth.password_reset_request",
      metadata: { email, account_found: false },
      request,
    })
    return NextResponse.json({ message: GENERIC_MESSAGE })
  }

  const { token } = await createPasswordResetToken(user.id)
  const resetUrl = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`
  await sendPasswordResetEmail(user.id, user.email, user.name, resetUrl)

  await writeAuditLog({
    userId: user.id,
    action: "auth.password_reset_request",
    metadata: { email },
    request,
  })

  return NextResponse.json({ message: GENERIC_MESSAGE })
}
