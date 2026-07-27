import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  assertEmailIncludesLogo,
  getEmailLogoAttachment,
  paragraphHtml,
  renderEmail,
} from "@/lib/email/template"

const getResend = () => {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const getFrom = () =>
  process.env.EMAIL_FROM ?? "CFCA Registration <onboarding@resend.dev>"

export const sendPasswordResetEmail = async (
  userId: string,
  email: string,
  name: string,
  resetUrl: string
) => {
  const subject = "Reset your CFCA Conference Registration password"
  const text = `Dear ${name},

We received a request to reset your password for the CFCA Conference Registration portal.

Click the link below to choose a new password (valid for a limited time):
${resetUrl}

If you did not request this, you can safely ignore this email. Your password will not change.

CFCA Conference Registration Team`

  const html = renderEmail({
    heading: "Reset your password",
    introHtml:
      paragraphHtml(`Dear ${name},`) +
      paragraphHtml(
        "We received a request to reset your password for the CFCA Conference Registration portal."
      ) +
      paragraphHtml(
        "Use the button below to choose a new password. This link is valid for a limited time."
      ),
    ctaLabel: "Reset password",
    ctaUrl: resetUrl,
    footerNote:
      "If you did not request this, you can safely ignore this email. Your password will not change.",
  })
  assertEmailIncludesLogo(html)
  const logoAttachment = getEmailLogoAttachment()

  const resend = getResend()

  if (!resend) {
    console.log(`[email] (dev) password_reset to ${email}: ${resetUrl}`)
    console.log(`[email] (dev) logo attached as cid:${logoAttachment.inlineContentId}`)
    await logPasswordResetEmail(userId, email, subject, null)
    return
  }

  const { data, error } = await resend.emails.send({
    from: getFrom(),
    to: email,
    subject,
    text,
    html,
    attachments: [logoAttachment],
  })

  if (error) {
    console.error("[email] Password reset send failed:", error)
  }

  await logPasswordResetEmail(userId, email, subject, data?.id ?? null)
}

const logPasswordResetEmail = async (
  userId: string,
  recipient: string,
  subject: string,
  resendId: string | null
) => {
  const admin = createAdminClient()
  await admin.from("email_log").insert({
    user_id: userId,
    email_type: "password_reset",
    recipient,
    subject,
    resend_id: resendId,
  })
}
