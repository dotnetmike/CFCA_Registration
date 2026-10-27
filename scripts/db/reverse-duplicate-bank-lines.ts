/**
 * Finds bank statement lines that repeat a transaction already imported from another CBA export
 * (e.g. the transaction-history export, which has no Balance column, re-importing days already covered
 * by a statement export) and marks them Ignored, reversing any payment they applied.
 *
 *   npm run db:reverse-duplicate-bank-lines -- --actor admin@example.org             # dry run
 *   npm run db:reverse-duplicate-bank-lines -- --actor admin@example.org --apply     # writes
 *
 * Uses the same path as Payment Reconcile → Ignored: a negative payment row per applied payment,
 * recalculated amount paid / payment status, reconciliation events and audit rows. No emails are sent.
 * The earliest import of each transaction is kept.
 */
import { initEnv, parseArgs } from "./lib/backup-common"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency } from "@/lib/pricing/calculate"
import { derivePaymentStatus } from "@/lib/payments/stripe-ledger"
import { findDuplicateBankLines, type StoredBankLine } from "@/lib/reconciliation/bank-dedupe"
import { getAppliedAmountsForLine } from "@/lib/reconciliation/ledger"
import { overrideReconciliationItem } from "@/lib/reconciliation/service"

type LineRow = {
  id: string
  transaction_date: string
  amount: number | string
  description: string
  status: string
  first_run_id: string | null
  created_at: string
}

type RegistrationRow = {
  id: string
  registration_no: string
  participant_reference: string | null
  amount_due: number | string
  amount_paid: number | string
  payment_status: string
}

const toCents = (value: number | string) => Math.round(Number(value) * 100)

const main = async () => {
  const args = parseArgs()
  const apply = args.apply === true
  const actorEmail = typeof args.actor === "string" ? args.actor.trim().toLowerCase() : ""
  if (!actorEmail) throw new Error("Pass --actor <admin email> (recorded on the reversal and audit rows)")

  const { appEnv, projectRef } = initEnv()
  const admin = createAdminClient()

  const { data: actor, error: actorError } = await admin
    .from("users")
    .select("id, email")
    .ilike("email", actorEmail)
    .maybeSingle()
  if (actorError) throw new Error(actorError.message)
  if (!actor) throw new Error(`No user with email ${actorEmail}`)

  const { data: runs } = await admin.from("reconciliation_runs").select("id, filename")
  const runName = new Map((runs ?? []).map((run) => [run.id as string, (run.filename as string) ?? run.id]))

  const { data: lineData, error: lineError } = await admin
    .from("bank_statement_lines")
    .select("id, transaction_date, amount, description, status, first_run_id, created_at")
    .limit(100000)
  if (lineError) throw new Error(lineError.message)
  const rows = (lineData ?? []) as LineRow[]
  const stored: (StoredBankLine & { row: LineRow })[] = rows.map((row) => ({
    id: row.id,
    transactionDate: row.transaction_date,
    amountCents: toCents(row.amount),
    description: row.description,
    runId: row.first_run_id,
    createdAt: row.created_at,
    row,
  }))
  const duplicates = findDuplicateBankLines(stored).filter((line) => line.row.status !== "ignored")

  const applied = new Map<string, Map<string, number>>()
  for (const line of duplicates) applied.set(line.id, await getAppliedAmountsForLine(line.id))

  const registrationIds = [...new Set([...applied.values()].flatMap((amounts) => [...amounts.keys()]))]
  const { data: regData, error: regError } = registrationIds.length
    ? await admin
        .from("registrations")
        .select("id, registration_no, participant_reference, amount_due, amount_paid, payment_status")
        .in("id", registrationIds)
    : { data: [], error: null }
  if (regError) throw new Error(regError.message)
  const registrations = new Map(((regData ?? []) as RegistrationRow[]).map((reg) => [reg.id, reg]))

  console.log(`Environment: ${appEnv} (${projectRef}) · ${rows.length} bank lines checked · actor ${actor.email}`)
  console.log(`${duplicates.length} duplicate bank line(s)${apply ? "" : " (dry run, nothing written)"}`)
  for (const line of duplicates) {
    const amounts = applied.get(line.id) ?? new Map()
    const payments = [...amounts]
      .map(([id, amount]) => `${registrations.get(id)?.participant_reference ?? id} ${formatCurrency(amount)}`)
      .join(", ")
    console.log(
      `  ${line.row.transaction_date} | ${formatCurrency(Number(line.row.amount))} | ${line.row.description} | ${line.row.status} | from ${runName.get(line.row.first_run_id ?? "") ?? "?"} | reverse: ${payments || "nothing applied"}`
    )
  }

  const reversedByRegistration = new Map<string, number>()
  for (const amounts of applied.values()) {
    for (const [id, amount] of amounts) reversedByRegistration.set(id, (reversedByRegistration.get(id) ?? 0) + amount)
  }
  console.log(`\nRegistrations affected: ${reversedByRegistration.size}`)
  for (const [id, reversed] of reversedByRegistration) {
    const reg = registrations.get(id)
    if (!reg) continue
    const paidAfter = Math.max(0, (toCents(reg.amount_paid) - toCents(reversed)) / 100)
    console.log(
      `  ${reg.registration_no} ${reg.participant_reference ?? ""} | fee ${formatCurrency(Number(reg.amount_due))} | paid ${formatCurrency(Number(reg.amount_paid))} → ${formatCurrency(paidAfter)} | status ${reg.payment_status} → ${derivePaymentStatus(Number(reg.amount_due), paidAfter)}`
    )
  }
  if (!apply || duplicates.length === 0) return

  let done = 0
  for (const line of duplicates) {
    const comment = `Duplicate of the same bank transaction already imported (${line.row.transaction_date}, ${formatCurrency(Number(line.row.amount))}); re-imported from ${runName.get(line.row.first_run_id ?? "") ?? "a later export"}, which has no Balance column.`
    await overrideReconciliationItem({
      input: { itemType: "bank", itemId: line.id, status: "ignored", comment },
      actorId: actor.id,
    })
    done += 1
  }
  console.log(`\nMarked ${done} duplicate line(s) Ignored and reversed their payments.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
