/**
 * Send one sample of every registration email type to a single address so the templates can be reviewed.
 *
 *   npm run email:samples -- --registration CFCA27-000040 --to you@example.com --site-url https://www.cfcanatcon.com
 *
 * Optional --types payment_reminder,early_bird_pricing_updated sends only those types.
 *
 * Read-only: loads the registration but never writes to the database (no email_log rows, no new view tokens).
 * Sends only to --to: no BCC to the notification recipient and nothing to the registrant.
 * Links that need a view token (View registration / Pay) use a placeholder token and will not open the registration.
 * Early bird pricing update samples are simulated in memory (payment due date passed / places filled);
 * they are skipped when the registration has no unpaid early-bird adults.
 */
import { initEnv, parseArgs } from "../db/lib/backup-common"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import {
  planEarlyBirdExpiry,
  type EarlyBirdExpiryCandidate,
} from "@/lib/registrations/early-bird-expiry"
import type { PricingConfig } from "@/lib/pricing/calculate"
import {
  buildRegistrationEmail,
  type EarlyBirdChangeNotice,
  type EmailType,
  type RegistrationEmailRecord,
} from "@/lib/email/send"
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

type Sample = {
  type: EmailType
  label: string
  registration: RegistrationEmailRecord
  earlyBirdChange?: EarlyBirdChangeNotice
}

const requireArg = (args: Record<string, string | true>, name: string) => {
  const value = args[name]
  if (typeof value !== "string" || !value.trim()) throw new Error(`Pass --${name} <value>`)
  return value.trim()
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Re-prices the registration in memory as the daily early-bird expiry would; nothing is saved. */
const simulateEarlyBirdExpiry = (
  registration: RegistrationEmailRecord,
  pricing: PricingConfig,
  now: Date
): Omit<Sample, "type" | "label"> | null => {
  const [change] = planEarlyBirdExpiry([registration as unknown as EarlyBirdExpiryCandidate], pricing, {
    now,
    canStorePartial: true,
  })
  if (!change?.feeChanged) return null
  return {
    registration: {
      ...registration,
      amount_due: change.after.amountDue,
      payment_status: change.after.paymentStatus,
      is_early_bird: change.after.isEarlyBird,
      early_bird_slot: change.after.earlyBirdSlot,
      early_bird_adult_limit: change.after.earlyBirdAdultLimit,
    },
    earlyBirdChange: {
      reason: change.reason,
      previousAmountDue: change.before.amountDue,
      adultsMoved: change.adultsMoved,
      adultsKeptEarlyBird: change.after.earlyBirdAdults,
    },
  }
}

const main = async () => {
  const args = parseArgs()
  const to = requireArg(args, "to")
  const registrationNo = requireArg(args, "registration")
  const siteUrl = requireArg(args, "site-url").replace(/\/$/, "")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error(`Invalid --to address: ${to}`)
  const allTypes: EmailType[] = [...SAMPLE_TYPES, "early_bird_pricing_updated"]
  const typesArg = args.types
  const types =
    typeof typesArg === "string" ? typesArg.split(",").map((type) => type.trim()).filter(Boolean) : allTypes
  const unknownType = types.find((type) => !allTypes.includes(type as EmailType))
  if (unknownType) throw new Error(`Unknown --types value: ${unknownType} (use ${allTypes.join(", ")})`)
  const wants = (type: EmailType) => types.includes(type)

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
  const { pricing } = await getRegistrationRuntimeSettings()

  const samples: Sample[] = SAMPLE_TYPES.filter(wants).map((type) => ({ type, label: type, registration }))
  const dueSample = simulateEarlyBirdExpiry(
    registration,
    pricing,
    new Date(Date.parse(`${pricing.earlyBirdPaymentDueDate}T12:00:00Z`) + 2 * DAY_MS)
  )
  const capacitySample = simulateEarlyBirdExpiry(
    registration,
    { ...pricing, earlyBirdVicLimit: 0, earlyBirdInterstateLimit: 0 },
    new Date(Date.parse(`${pricing.earlyBirdPaymentDueDate}T12:00:00Z`) - 2 * DAY_MS)
  )
  if (dueSample && wants("early_bird_pricing_updated")) {
    samples.push({ type: "early_bird_pricing_updated", label: "early_bird_pricing_updated (due date passed)", ...dueSample })
  }
  if (capacitySample && wants("early_bird_pricing_updated")) {
    samples.push({ type: "early_bird_pricing_updated", label: "early_bird_pricing_updated (places filled)", ...capacitySample })
  }

  console.log(`Environment: ${appEnv} (${projectRef}) · provider ${getEmailProviderId()}`)
  console.log(`Sample data: ${registrationNo} · sending ${samples.length} emails to ${to} only (no BCC, no email_log)`)
  if (wants("early_bird_pricing_updated") && !dueSample && !capacitySample) {
    console.log("  (no early bird pricing update samples: registration has no unpaid early-bird adults)")
  }

  const logo = getEmailLogoAttachment()
  let failed = 0
  for (const sample of samples) {
    const email = buildRegistrationEmail(sample.registration, sample.type, {
      siteUrl,
      viewToken: SAMPLE_VIEW_TOKEN,
      pricing,
      earlyBirdChange: sample.earlyBirdChange,
    })
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
    console.log(`  ${sent ? "sent" : result.skipped ? "skipped (provider not configured)" : "FAILED"} · ${sample.label} · ${subject}`)
  }
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
