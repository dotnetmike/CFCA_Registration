/**
 * Re-price saved registrations with the current pricing rules and runtime prices.
 *
 *   npm run db:reprice-registrations              # dry run: lists affected registrations (before → after)
 *   npm run db:reprice-registrations -- --apply   # updates amount_due + payment_status, one audit row each
 *
 * Only registrations whose stored amount due differs from the recalculated amount are touched.
 * The early-bird slot stored on each registration is kept. Amount paid is never changed and no emails are sent.
 */
import { initEnv, parseArgs } from "./lib/backup-common"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency } from "@/lib/pricing/calculate"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { planRegistrationRepricing, type RepriceCandidate, type RepriceChange } from "@/lib/registrations/reprice"
import { earlyBirdLimitSelect } from "@/lib/registrations/early-bird-column"

const REPRICE_ACTION = "registration.reprice"
const REPRICE_REASON =
  "Pricing rules corrected: adults 18+ at adult rate, 12–17 at youth rate, 2–11 at child rate, 0–1 free"

const formatRow = (change: RepriceChange) =>
  [
    change.registrationNo,
    change.name,
    `ages [${change.attendeeAges.join(", ")}]`,
    `slot ${change.earlyBirdSlot}`,
    `paid ${formatCurrency(change.amountPaid)}`,
    `fee ${formatCurrency(change.before.amountDue)} → ${formatCurrency(change.after.amountDue)}`,
    `balance ${formatCurrency(change.before.balance)} → ${formatCurrency(change.after.balance)}`,
    `status ${change.before.paymentStatus} → ${change.after.paymentStatus}`,
  ].join(" | ")

const main = async () => {
  const args = parseArgs()
  const apply = args.apply === true
  const { appEnv, projectRef } = initEnv()
  const admin = createAdminClient()
  const settings = await getRegistrationRuntimeSettings()

  const { data, error } = await admin
    .from("registrations")
    .select(
      await earlyBirdLimitSelect(
        "id, registration_no, given_name, surname, spouse_attending, souvenir_orders, is_early_bird, early_bird_slot, amount_due, amount_paid, payment_status, registration_attendees(age)"
      )
    )
    .order("registration_no")
    .limit(10000)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as unknown as RepriceCandidate[]
  const changes = planRegistrationRepricing(rows, settings.pricing)

  console.log(`Environment: ${appEnv} (${projectRef}) · ${rows.length} registrations checked`)
  console.log(
    `Prices: adult early bird ${formatCurrency(settings.pricing.adultEarlyBird)}, adult ${formatCurrency(settings.pricing.adultRegular)}, 12–17 ${formatCurrency(settings.pricing.age12Plus)}, 2–11 ${formatCurrency(settings.pricing.age2To12)}, 0–1 ${formatCurrency(settings.pricing.ageFree)}`
  )
  console.log(`${changes.length} affected registration(s)${apply ? "" : " (dry run, nothing written)"}`)
  for (const change of changes) console.log(`  ${formatRow(change)}`)
  if (!apply || changes.length === 0) return

  let updated = 0
  for (const change of changes) {
    const { data: rowsUpdated, error: updateError } = await admin
      .from("registrations")
      .update({
        amount_due: change.after.amountDue,
        payment_status: change.after.paymentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id)
      .eq("amount_due", change.before.amountDue)
      .select("id")
    if (updateError) throw new Error(`${change.registrationNo}: ${updateError.message}`)
    if (!rowsUpdated?.length) {
      console.warn(`  skipped ${change.registrationNo}: changed since the plan was built, re-run to re-check`)
      continue
    }
    await admin.from("audit_log").insert({
      user_id: null,
      action: REPRICE_ACTION,
      previous_value: { amount_due: change.before.amountDue, payment_status: change.before.paymentStatus },
      updated_value: { amount_due: change.after.amountDue, payment_status: change.after.paymentStatus },
      metadata: { registration_id: change.id, registration_no: change.registrationNo, reason: REPRICE_REASON },
    })
    updated += 1
  }
  console.log(`Updated ${updated} of ${changes.length} registration(s).`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
