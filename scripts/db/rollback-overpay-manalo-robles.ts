/**
 * Rollback for fix-overpay-manalo-robles.ts using its JSON snapshot.
 *
 *   npx tsx scripts/db/rollback-overpay-manalo-robles.ts --actor admin@example.org --snapshot <path>
 *   npx tsx scripts/db/rollback-overpay-manalo-robles.ts --actor admin@example.org --snapshot <path> --apply
 *
 * Restores app DB only. Does not refund or change Stripe. Does not unsend emails.
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
  NOTE_TAG,
  loadOpsArgs,
  readSnapshot,
  resolveActor,
  summarizeReg,
} from "./lib/overpay-manalo-robles-common"

const main = async () => {
  const { apply, actorEmail, snapshotPath } = loadOpsArgs()
  if (!snapshotPath) throw new Error("Pass --snapshot <path-to-json>")

  const { appEnv, projectRef } = initEnv()
  const admin = createAdminClient()
  const actor = await resolveActor(admin, actorEmail)
  const snapshot = readSnapshot(snapshotPath)

  console.log(
    `Environment: ${appEnv} (${projectRef}) · actor ${actor.email} · ${apply ? "APPLY ROLLBACK" : "DRY RUN"}`
  )
  console.log(`Snapshot: ${snapshotPath} (created ${snapshot.createdAt} by ${snapshot.actorEmail})`)

  const nitoSnap = snapshot.registrations[TARGETS.nitoDup.id]
  if (!nitoSnap) throw new Error("Snapshot missing CFCA27-000087 registration row")

  const { data: existingNito } = await admin
    .from("registrations")
    .select("id")
    .eq("id", TARGETS.nitoDup.id)
    .maybeSingle()

  const { data: candyNow } = await admin
    .from("registrations")
    .select("*")
    .eq("id", TARGETS.candy.id)
    .maybeSingle()
  const { data: marissaNow } = await admin
    .from("registrations")
    .select("*")
    .eq("id", TARGETS.marissa.id)
    .maybeSingle()
  const { data: gladysNow } = await admin
    .from("registrations")
    .select("*")
    .eq("id", TARGETS.gladys.id)
    .maybeSingle()
  const { data: titaNow } = await admin
    .from("registrations")
    .select("*")
    .eq("id", TARGETS.tita.id)
    .maybeSingle()
  const { data: stripeNow } = await admin
    .from("payments")
    .select("*")
    .eq("id", STRIPE_PAYMENT_ID)
    .maybeSingle()
  const { data: bankNow } = await admin
    .from("bank_statement_lines")
    .select("id, status, matched_registration_id")
    .eq("id", MARISSA_EXTRA_BANK_LINE_ID)
    .maybeSingle()

  console.log("\n=== CURRENT ===")
  console.log(`  ${summarizeReg((candyNow ?? undefined) as Record<string, unknown> | undefined)}`)
  console.log(`  ${summarizeReg((marissaNow ?? undefined) as Record<string, unknown> | undefined)}`)
  console.log(`  ${summarizeReg((gladysNow ?? undefined) as Record<string, unknown> | undefined)}`)
  console.log(`  ${summarizeReg((titaNow ?? undefined) as Record<string, unknown> | undefined)}`)
  console.log(`  CFCA27-000087 | ${existingNito ? "exists" : "(deleted — will re-insert)"}`)
  console.log(`  Stripe payment on reg=${stripeNow?.registration_id ?? "(missing)"}`)
  console.log(`  Marissa Fast Transfer status=${bankNow?.status ?? "(missing)"}`)

  console.log("\nPlanned rollback:")
  console.log("  1. Re-insert CFCA27-000087 from snapshot")
  console.log(`  2. Move Stripe ${STRIPE_PI} back to CFCA27-000087; restore Candy paid fields`)
  console.log(`  3. Re-insert Candy manual payment ${CANDY_MANUAL_PAYMENT_ID} if snapshotted`)
  console.log(`  4. Delete ops admin notes tagged ${NOTE_TAG}`)
  console.log("  5. Re-match Marissa Fast Transfer bank line (undo ignore)")
  console.log("  6. Restore registration paid/spouse fields from snapshot")

  if (!apply) {
    console.log("\nDry run only — nothing written. Re-run with --apply after approval.")
    return
  }

  if (!existingNito) {
    console.log("\nRe-inserting CFCA27-000087…")
    const { error: insertError } = await admin.from("registrations").insert(nitoSnap)
    if (insertError) throw new Error(`Re-insert 000087 failed: ${insertError.message}`)
  } else {
    console.log("\nCFCA27-000087 already present — skipping insert")
  }

  console.log("Moving Stripe ledger back to CFCA27-000087…")
  const { error: movePayError } = await admin
    .from("payments")
    .update({ registration_id: TARGETS.nitoDup.id })
    .eq("id", STRIPE_PAYMENT_ID)
  if (movePayError) throw new Error(movePayError.message)

  if (snapshot.candyManualPayment) {
    console.log("Re-inserting Candy manual payment…")
    const { data: existingManual } = await admin
      .from("payments")
      .select("id")
      .eq("id", CANDY_MANUAL_PAYMENT_ID)
      .maybeSingle()
    if (!existingManual) {
      const { error: manualInsError } = await admin
        .from("payments")
        .insert(snapshot.candyManualPayment)
      if (manualInsError) throw new Error(manualInsError.message)
    }
  }

  const candySnap = snapshot.registrations[TARGETS.candy.id]
  const nitoPaySnap = snapshot.registrations[TARGETS.nitoDup.id]
  const marissaSnap = snapshot.registrations[TARGETS.marissa.id]
  const gladysSnap = snapshot.registrations[TARGETS.gladys.id]
  const titaSnap = snapshot.registrations[TARGETS.tita.id]
  const now = new Date().toISOString()

  const restorePaid = async (id: string, snap: Record<string, unknown>) => {
    const { error } = await admin
      .from("registrations")
      .update({
        amount_paid: snap.amount_paid,
        payment_status: snap.payment_status,
        payment_last_updated_source: snap.payment_last_updated_source,
        payment_last_updated_at: snap.payment_last_updated_at,
        payment_last_updated_by: snap.payment_last_updated_by,
        updated_at: now,
      })
      .eq("id", id)
    if (error) throw new Error(error.message)
  }

  await restorePaid(TARGETS.candy.id, candySnap)
  await restorePaid(TARGETS.nitoDup.id, nitoPaySnap)

  console.log("Removing ops admin notes…")
  const noteIds = snapshot.createdNoteIds ?? []
  if (noteIds.length) {
    const { error: noteDelError } = await admin
      .from("registration_admin_notes")
      .delete()
      .in("id", noteIds)
    if (noteDelError) throw new Error(noteDelError.message)
  } else {
    const { error: noteDelError } = await admin
      .from("registration_admin_notes")
      .delete()
      .in("registration_id", [TARGETS.candy.id, TARGETS.tita.id])
      .like("body", `${NOTE_TAG}%`)
    if (noteDelError) throw new Error(noteDelError.message)
  }

  console.log("Re-matching Marissa Fast Transfer…")
  await overrideReconciliationItem({
    input: {
      itemType: "bank",
      itemId: MARISSA_EXTRA_BANK_LINE_ID,
      status: "matched",
      registrationId: TARGETS.marissa.id,
      comment: "Rollback: restore Marissa Fast Transfer match from ops overpay-manalo-robles",
    },
    actorId: actor.id,
  })

  console.log("Restoring registration fields from snapshot…")
  await restorePaid(TARGETS.marissa.id, marissaSnap)
  await restorePaid(TARGETS.gladys.id, gladysSnap)
  const { error: spouseError } = await admin
    .from("registrations")
    .update({
      spouse_given_name: titaSnap.spouse_given_name,
      spouse_surname: titaSnap.spouse_surname,
      amount_paid: titaSnap.amount_paid,
      payment_status: titaSnap.payment_status,
      updated_at: now,
    })
    .eq("id", TARGETS.tita.id)
  if (spouseError) throw new Error(spouseError.message)

  for (const emailRow of snapshot.emailLogForDeleted) {
    if (!emailRow.id) continue
    await admin
      .from("email_log")
      .update({ registration_id: TARGETS.nitoDup.id })
      .eq("id", emailRow.id as string)
  }

  await writeAuditLog({
    userId: actor.id,
    action: "registration.update",
    previousValue: { ops: "rollback-started" },
    updatedValue: { ops: "rollback-complete", snapshot: snapshotPath },
    metadata: {
      ops: "rollback-overpay-manalo-robles",
      stripe_payment_intent_id: STRIPE_PI,
    },
  })

  const { data: after } = await admin
    .from("registrations")
    .select(
      "registration_no, given_name, surname, spouse_given_name, spouse_surname, amount_due, amount_paid, payment_status"
    )
    .in("id", Object.values(TARGETS).map((t) => t.id))
    .order("registration_no")

  console.log("\n=== AFTER ROLLBACK ===")
  for (const row of after ?? []) console.log(`  ${summarizeReg(row as Record<string, unknown>)}`)
  console.log("\nRollback complete (app DB only; Stripe charge unchanged).")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
