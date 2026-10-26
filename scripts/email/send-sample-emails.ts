/**
 * Send one sample of every registration email type to a single address so the templates can be reviewed.
 *
 *   npm run email:samples -- --registration CFCA27-000040 --to you@example.com --site-url https://www.cfcanatcon.com
 *
 * Read-only: loads the registration but never writes to the database (no email_log rows, no new view tokens).
 * Sends only to --to: no BCC to the notification recipient and nothing to the registrant.
 * Links that need a view token (View registration / Pay) use a placeholder token and will not open the registration.
 */
import { initEnv, parseArgs } from "../db/lib/backup-common"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { buildRegistrationEmail, type EmailType, type RegistrationEmailRecord } from "@/lib/email/send"
import { getEmailLogoAttachment } from "@/lib/email/template"
import { getEmailProviderId, sendTransactionalEmail } from "@/lib/email/provider"

const SAMPLE_TYPES: EmailType[] = [
  "registration_submitted",
  "registration_updated",
  "accommodation_updated",
  "payment_received",
  "payment_reminder",
]

const SAMPLE_VIEW_TOKEN = "sample-link-not-valid"

const requireArg = (args: Record<string, string | true>, name: string) => {
  const value = args[name]
  if (typeof value !== "string" || !value.trim()) throw new Error(`Pass --${name} <value>`)
  return value.trim()
}

const main = async () => {
  const args = parseArgs()
  const to = requireArg(args, "to")
  const registrationNo = requireArg(args, "registration")
  const siteUrl = requireArg(args, "site-url").replace(/\/$/, "")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error(`Invalid --to address: ${to}`)

  const { appEnv, projectRef } = initEnv()
  const admin = createAdminClient()
  const { data: match, error } = await admin
    .from("registrations")
    .select("id")
    .eq("registration_no", registrationNo)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!match) throw new Error(`Registration ${registrationNo} not found`)

  const registration = (await getRegistrationWithAttendees(match.id)) as RegistrationEmailRecord | null
  if (!registration) throw new Error(`Could not load ${registrationNo}`)

  console.log(`Environment: ${appEnv} (${projectRef}) · provider ${getEmailProviderId()}`)
  console.log(`Sample data: ${registrationNo} · sending ${SAMPLE_TYPES.length} emails to ${to} only (no BCC, no email_log)`)

  const logo = getEmailLogoAttachment()
  let failed = 0
  for (const type of SAMPLE_TYPES) {
    const email = buildRegistrationEmail(registration, type, { siteUrl, viewToken: SAMPLE_VIEW_TOKEN })
    const subject = `[SAMPLE] ${email.subject}`
    const result = await sendTransactionalEmail({
      to,
      subject,
      text: email.text,
      html: email.html,
      attachments: [logo],
    })
    const sent = Boolean(result.id) && !result.skipped
    if (!sent) failed += 1
    console.log(`  ${sent ? "sent" : result.skipped ? "skipped (provider not configured)" : "FAILED"} · ${type} · ${subject}`)
  }
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
