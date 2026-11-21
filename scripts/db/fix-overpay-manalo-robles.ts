/**
 * One-off production ops (remaining work after concurrent admin already marked
 * Marissa/Gladys/Candy paid via manual entries):
 * 1) Ignore Marissa's extra Fast Transfer bank line so payment ledger nets to $220
 * 2) Replace Candy's manual $440 with Stripe ledger from CFCA27-000087 + notes
 * 3) Delete CFCA27-000087 (no Stripe refund)
 * 4) Fix spouse name on CFCA27-000086 to Nito Manalo
 *
 *   npx tsx scripts/db/fix-overpay-manalo-robles.ts --actor admin@example.org
 *   npx tsx scripts/db/fix-overpay-manalo-robles.ts --actor admin@example.org --apply
 */
import { initEnv } from "./lib/backup-common"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/log"
import { overrideReconciliationItem } from "@/lib/reconciliation/service"
import {
  TARGETS,
  MARISSA_EXTRA_BANK_LINE_ID,
  STRIPE_PAYMENT_ID,
  STRIPE_PI,
  CANDY_MANUAL_PAYMENT_ID,
  assertApplyPreconditions,
  buildNoteBodies,
  fetchSnapshotData,
  loadOpsArgs,
  resolveActor,
  summarizeReg,
  writeSnapshot,
  type OpsSnapshot,
} from "./lib/overpay-manalo-robles-common"

const printState = async (admin: ReturnType<typeof createAdminClient>, label: string) => {
  const ids = Object.values(TARGETS).map((t) => t.id)
  const { data } = await admin
    .from("registrations")
    .select(
      "id, registration_no, given_name, surname, spouse_given_name, spouse_surname, amount_due, amount_paid, payment_status"
    )
    .in("id", ids)
    .order("registration_no")
  console.log(`\n=== ${label} ===`)
  for (const row of data ?? []) console.log(`  ${summarizeReg(row as Record<string, unknown>)}`)
  const missing = ids.filter((id) => !(data ?? []).some((r) => r.id === id))
  for (const id of missing) {
    const code = Object.values(TARGETS).find((t) => t.id === id)?.registrationNo ?? id
    console.log(`  ${code} | (deleted)`)
  }
  const { data: stripe } = await admin
    .from("payments")
    .select("id, registration_id, amount, source, stripe_payment_intent_id")
    .eq("id", STRIPE_PAYMENT_ID)
    .maybeSingle()
  console.log(
    `  Stripe ${STRIPE_PAYMENT_ID}: reg=${stripe?.registration_id ?? "(missing)"} amount=${stripe?.amount ?? "-"}`
  )
  const { data: manual } = await admin
    .from("payments")
    .select("id, registration_id, amount")
    .eq("id", CANDY_MANUAL_PAYMENT_ID)
    .maybeSingle()
  console.log(
    `  Candy manual ${CANDY_MANUAL_PAYMENT_ID}: ${manual ? `reg=${manual.registration_id} amount=${manual.amount}` : "(removed)"}`
  )
  const { data: bank } = await admin
    .from("bank_statement_lines")
    .select("id, status, matched_registration_id")
    .eq("id", MARISSA_EXTRA_BANK_LINE_ID)
    .maybeSingle()
  console.log(
    `  Marissa Fast Transfer ${MARISSA_EXTRA_BANK_LINE_ID}: status=${bank?.status} matched=${bank?.matched_registration_id}`
  )
}

const main = async () => {
  const { apply, actorEmail } = loadOpsArgs()
  const { appEnv, projectRef } = initEnv()
  const admin = createAdminClient()
  const actor = await resolveActor(admin, actorEmail)
  const noteBodies = buildNoteBodies()

  console.log(
    `Environment: ${appEnv} (${projectRef}) · actor ${actor.email} · ${apply ? "APPLY" : "DRY RUN"}`
  )

  const data = await fetchSnapshotData(admin)
  assertApplyPreconditions(data)
  await printState(admin, "BEFORE")

  const stepsCompletedByOthers = [
    "Marissa CFCA27-000026 already amount_paid=220 / paid (manual clear of overpay display)",
    "Gladys CFCA27-000070 already amount_paid=220 / paid (manual $220 + admin note)",
    "Candy CFCA27-000001 already amount_paid=440 / paid (manual $440) — will replace with Stripe ledger",
  ]

  console.log("\nAlready done by others:")
  for (const step of stepsCompletedByOthers) console.log(`  • ${step}`)

  console.log("\nPlanned remaining changes:")
  console.log(
    `  1. Ignore Marissa Fast Transfer bank line ${MARISSA_EXTRA_BANK_LINE_ID} (ledger hygiene; restore amount_paid=220/paid)`
  )
  console.log(
    `  2. Delete Candy manual payment ${CANDY_MANUAL_PAYMENT_ID}; move Stripe ${STRIPE_PI} from 000087 → 000001; keep paid $440`
  )
  console.log(`  3. Add admin notes on CFCA27-000001 and CFCA27-000086`)
  console.log(`  4. Delete CFCA27-000087 (no Stripe refund)`)
  console.log(`  5. Spouse on CFCA27-000086: Manalo Boyet → Nito Manalo`)

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply after approval.")
    return
  }

  const snapshot: OpsSnapshot = {
    ...data,
    createdAt: new Date().toISOString(),
    actorEmail: actor.email,
    actorId: actor.id,
    noteBodies,
    stepsCompletedByOthers,
  }
  const snapshotPath = writeSnapshot(snapshot)
  console.log(`\nSnapshot written: ${snapshotPath}`)

  console.log("\nIgnoring Marissa Fast Transfer (ledger hygiene)…")
  await overrideReconciliationItem({
    input: {
      itemType: "bank",
      itemId: MARISSA_EXTRA_BANK_LINE_ID,
      status: "ignored",
      comment:
        "Ops overpay-manalo-robles: reverse extra Fast Transfer so Marissa ledger nets to fee $220 (Gladys already paid manually)",
    },
    actorId: actor.id,
  })
  // Ignore reverses amount_paid to 0; restore the concurrent paid state
  const now = new Date().toISOString()
  const { error: marissaRestoreError } = await admin
    .from("registrations")
    .update({
      amount_paid: 220,
      payment_status: "paid",
      payment_last_updated_source: "manual",
      payment_last_updated_at: now,
      payment_last_updated_by: actor.id,
      updated_at: now,
    })
    .eq("id", TARGETS.marissa.id)
  if (marissaRestoreError) throw new Error(marissaRestoreError.message)

  console.log("Replacing Candy manual payment with Stripe ledger…")
  if (snapshot.candyManualPayment) {
    const { error: delManualError } = await admin
      .from("payments")
      .delete()
      .eq("id", CANDY_MANUAL_PAYMENT_ID)
    if (delManualError) throw new Error(delManualError.message)
  }

  const { error: movePayError } = await admin
    .from("payments")
    .update({ registration_id: TARGETS.candy.id })
    .eq("id", STRIPE_PAYMENT_ID)
    .eq("registration_id", TARGETS.nitoDup.id)
  if (movePayError) throw new Error(movePayError.message)

  const { error: candyError } = await admin
    .from("registrations")
    .update({
      amount_paid: 440,
      payment_status: "paid",
      payment_last_updated_source: "manual",
      payment_last_updated_at: now,
      payment_last_updated_by: actor.id,
      updated_at: now,
    })
    .eq("id", TARGETS.candy.id)
  if (candyError) throw new Error(candyError.message)

  const { error: nitoZeroError } = await admin
    .from("registrations")
    .update({
      amount_paid: 0,
      payment_status: "pending",
      payment_last_updated_source: "manual",
      payment_last_updated_at: now,
      payment_last_updated_by: actor.id,
      updated_at: now,
    })
    .eq("id", TARGETS.nitoDup.id)
  if (nitoZeroError) throw new Error(nitoZeroError.message)

  await writeAuditLog({
    userId: actor.id,
    action: "payment.manual_update",
    previousValue: {
      from_registration: TARGETS.nitoDup.registrationNo,
      to_registration: TARGETS.candy.registrationNo,
      payment_id: STRIPE_PAYMENT_ID,
      removed_manual_payment_id: CANDY_MANUAL_PAYMENT_ID,
    },
    updatedValue: {
      stripe_payment_intent_id: STRIPE_PI,
      amount: 440,
      candy_amount_paid: 440,
      candy_payment_status: "paid",
    },
    metadata: {
      ops: "overpay-manalo-robles",
      registration_id: TARGETS.candy.id,
      snapshot: snapshotPath,
    },
  })

  console.log("Inserting admin notes…")
  const { data: candyNote, error: candyNoteError } = await admin
    .from("registration_admin_notes")
    .insert({
      registration_id: TARGETS.candy.id,
      body: noteBodies.candy,
      created_by: actor.id,
    })
    .select("id")
    .single()
  if (candyNoteError || !candyNote) throw new Error(candyNoteError?.message ?? "Candy note failed")

  const { data: titaNote, error: titaNoteError } = await admin
    .from("registration_admin_notes")
    .insert({
      registration_id: TARGETS.tita.id,
      body: noteBodies.tita,
      created_by: actor.id,
    })
    .select("id")
    .single()
  if (titaNoteError || !titaNote) throw new Error(titaNoteError?.message ?? "Tita note failed")

  snapshot.createdNoteIds = [candyNote.id as string, titaNote.id as string]
  writeSnapshot(snapshot)

  console.log("Fixing spouse name on CFCA27-000086…")
  const { error: spouseError } = await admin
    .from("registrations")
    .update({
      spouse_given_name: "Nito",
      spouse_surname: "Manalo",
      updated_at: now,
    })
    .eq("id", TARGETS.tita.id)
  if (spouseError) throw new Error(spouseError.message)

  await writeAuditLog({
    userId: actor.id,
    action: "registration.update",
    previousValue: { spouse_given_name: "Manalo", spouse_surname: "Boyet" },
    updatedValue: { spouse_given_name: "Nito", spouse_surname: "Manalo" },
    metadata: {
      ops: "overpay-manalo-robles",
      registration_id: TARGETS.tita.id,
      registration_no: TARGETS.tita.registrationNo,
    },
  })

  console.log("Deleting CFCA27-000087…")
  const { error: deleteError } = await admin
    .from("registrations")
    .delete()
    .eq("id", TARGETS.nitoDup.id)
  if (deleteError) throw new Error(deleteError.message)

  await writeAuditLog({
    userId: actor.id,
    action: "registration.delete",
    previousValue: snapshot.registrations[TARGETS.nitoDup.id],
    updatedValue: null,
    metadata: {
      ops: "overpay-manalo-robles",
      registration_no: TARGETS.nitoDup.registrationNo,
      snapshot: snapshotPath,
      stripe_left_in_stripe: STRIPE_PI,
    },
  })

  await printState(admin, "AFTER")
  console.log(`\nDone. Snapshot for rollback: ${snapshotPath}`)
  console.log(
    `Rollback dry-run: npx tsx scripts/db/rollback-overpay-manalo-robles.ts --actor ${actor.email} --snapshot "${snapshotPath}"`
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
