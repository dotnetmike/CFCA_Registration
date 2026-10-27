import { createHash } from "node:crypto"
import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/log"
import { sendRegistrationEmail } from "@/lib/email/send"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { formatPaymentStatus } from "@/lib/payments/labels"
import {
  AWAITING_STRIPE_EXPORT_METHOD,
  assignPayouts,
  buildStripeMatchContext,
  classifyStripeType,
  computeStripeSettlement,
  formatCents,
  matchBankPayoutLine,
  matchBankTransferLine,
  matchStripeRow,
  toCents,
  type MatchOutcome,
  type PayoutSummary,
  type RegistrationRef,
  type StripeCoverage,
  type StripeMatchContext,
  type StripeSettlement,
} from "@/lib/reconciliation/matching"
import {
  parseCbaStatement,
  parseStripeBalanceHistory,
  ReconciliationFileError,
} from "@/lib/reconciliation/parsers"
import {
  applyBankLinePayment,
  getAppliedAmountsForLine,
  reverseBankLinePayments,
} from "@/lib/reconciliation/ledger"
import { RECONCILIATION_STATUS_LABELS } from "@/lib/reconciliation/labels"
import { summarizeReconciledAmounts } from "@/lib/reconciliation/reconciled-amounts"
import { bankLineContentKey, selectNewBankLines } from "@/lib/reconciliation/bank-dedupe"
import type {
  BankLineKind,
  BankSettlement,
  ReconciledAmountsResponse,
  ReconciliationEventView,
  ReconciliationItemType,
  ReconciliationOverrideRequest,
  ReconciliationOverview,
  ReconciliationRunSource,
  ReconciliationRunView,
  ReconciliationStatus,
} from "@/lib/reconciliation/types"

type AdminClient = ReturnType<typeof createAdminClient>

export class ReconciliationConflictError extends Error {}

const CHUNK_SIZE = 200
const PAGE_SIZE = 1000
const RUN_LOCK_MINUTES = 10

const chunk = <T>(items: T[], size = CHUNK_SIZE) => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

const selectAll = async <T>(page: (from: number, to: number) => PageResult<T>) => {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

type StripeRow = {
  id: string
  stripe_txn_id: string
  type: string
  source_id: string
  amount: number | string
  fee: number | string
  net: number | string
  currency: string
  created_utc: string
  available_on_utc: string
  metadata_registration_id: string
  metadata_participant_reference: string
  status: ReconciliationStatus
  status_reason: string
  match_method: string
  matched_registration_id: string | null
  payment_id: string | null
  manual_override: boolean
  status_comment: string
  status_updated_by: string | null
  status_updated_at: string | null
  payout_id: string
  bank_line_id: string | null
  bank_received_date: string | null
}

type BankRow = {
  id: string
  fingerprint: string
  transaction_date: string
  amount: number | string
  description: string
  balance: number | string | null
  kind: BankLineKind
  status: ReconciliationStatus
  status_reason: string
  match_method: string
  matched_registration_id: string | null
  matched_stripe_payout_id: string
  manual_override: boolean
  status_comment: string
  status_updated_by: string | null
  status_updated_at: string | null
}

type RegistrationRow = {
  id: string
  registration_no: string
  participant_reference: string | null
  given_name: string
  surname: string
  amount_due: number | string
  amount_paid: number | string
  payment_status: string
  created_at: string
}

type EventInsert = {
  run_id: string | null
  item_type: ReconciliationItemType | null
  item_id: string | null
  action: string
  from_status?: string | null
  to_status?: string | null
  registration_id?: string | null
  amount?: number | null
  comment?: string
  details?: Record<string, unknown>
  actor_id: string | null
}

type RunCounters = {
  rowsInFile: number
  newRows: number
  skippedRows: number
  recheckedRows: number
  matched: number
  unmatched: number
  notApplicable: number
  paymentsApplied: number
  amountAppliedCents: number
  bankConfirmed: number
}

const emptyCounters = (): RunCounters => ({
  rowsInFile: 0,
  newRows: 0,
  skippedRows: 0,
  recheckedRows: 0,
  matched: 0,
  unmatched: 0,
  notApplicable: 0,
  paymentsApplied: 0,
  amountAppliedCents: 0,
  bankConfirmed: 0,
})

const countStatus = (counters: RunCounters, status: ReconciliationStatus) => {
  if (status === "matched") counters.matched += 1
  else if (status === "unmatched") counters.unmatched += 1
  else if (status === "not_applicable") counters.notApplicable += 1
}

const STRIPE_COLUMNS =
  "id, stripe_txn_id, type, source_id, amount, fee, net, currency, created_utc, available_on_utc, metadata_registration_id, metadata_participant_reference, status, status_reason, match_method, matched_registration_id, payment_id, manual_override, status_comment, status_updated_by, status_updated_at, payout_id, bank_line_id, bank_received_date"
const BANK_COLUMNS =
  "id, fingerprint, transaction_date, amount, description, balance, kind, status, status_reason, match_method, matched_registration_id, matched_stripe_payout_id, manual_override, status_comment, status_updated_by, status_updated_at"
const REGISTRATION_COLUMNS =
  "id, registration_no, participant_reference, given_name, surname, amount_due, amount_paid, payment_status, created_at"

const isOpenForAutoMatch = (row: { status: ReconciliationStatus; manual_override: boolean }) =>
  row.status === "unmatched" && !row.manual_override

const insertEvents = async (admin: AdminClient, events: EventInsert[]) => {
  for (const batch of chunk(events, 500)) {
    const { error } = await admin.from("reconciliation_events").insert(batch)
    if (error) throw new Error(error.message)
  }
}

const loadRegistrations = async (admin: AdminClient) =>
  selectAll<RegistrationRow>((from, to) =>
    admin.from("registrations").select(REGISTRATION_COLUMNS).order("created_at").range(from, to)
  )

const toRegistrationRef = (row: RegistrationRow): RegistrationRef => ({
  id: row.id,
  registrationNo: row.registration_no,
  participantReference: row.participant_reference ?? "",
  createdAt: row.created_at,
})

const loadAllStripeRows = async (admin: AdminClient) =>
  selectAll<StripeRow>((from, to) =>
    admin
      .from("stripe_balance_transactions")
      .select(STRIPE_COLUMNS)
      .order("created_utc", { ascending: false })
      .range(from, to)
  )

const loadAllBankRows = async (admin: AdminClient) =>
  selectAll<BankRow>((from, to) =>
    admin
      .from("bank_statement_lines")
      .select(BANK_COLUMNS)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to)
  )

const toPayoutInputs = (rows: StripeRow[]) =>
  rows.map((r) => ({
    stripeTxnId: r.stripe_txn_id,
    type: r.type,
    sourceId: r.source_id,
    createdUtc: r.created_utc,
    availableOnUtc: r.available_on_utc,
    amountCents: toCents(r.amount),
    netCents: toCents(r.net),
  }))

/**
 * Stores, for every Stripe row, the payout that paid it out and the CBA line that received it.
 * Recomputed from all stored rows so the result does not depend on upload order.
 * Returns how many Stripe rows became confirmed as received in the bank.
 */
const syncStripeSettlement = async (admin: AdminClient, runId: string | null, actorId: string) => {
  const stripeRows = await loadAllStripeRows(admin)
  if (stripeRows.length === 0) return 0
  const matchedLines = await selectAll<{ id: string; transaction_date: string; matched_stripe_payout_id: string }>(
    (from, to) =>
      admin
        .from("bank_statement_lines")
        .select("id, transaction_date, matched_stripe_payout_id")
        .eq("status", "matched")
        .neq("matched_stripe_payout_id", "")
        .range(from, to)
  )
  const settlement = computeStripeSettlement(
    toPayoutInputs(stripeRows),
    matchedLines.map((l) => ({ id: l.id, transactionDate: l.transaction_date, payoutId: l.matched_stripe_payout_id }))
  )

  const groups = new Map<string, { values: StripeSettlement; ids: string[] }>()
  const events: EventInsert[] = []
  let confirmed = 0
  for (const row of stripeRows) {
    const next = settlement.get(row.stripe_txn_id)
    if (!next) continue
    const unchanged =
      row.payout_id === next.payoutId &&
      row.bank_line_id === next.bankLineId &&
      (row.bank_received_date ?? null) === next.bankDate
    if (unchanged) continue

    const key = `${next.payoutId}|${next.bankLineId ?? ""}|${next.bankDate ?? ""}`
    const group = groups.get(key) ?? { values: next, ids: [] }
    group.ids.push(row.id)
    groups.set(key, group)

    if (next.bankLineId && next.bankLineId !== row.bank_line_id) {
      confirmed += 1
      events.push({
        run_id: runId,
        item_type: "stripe",
        item_id: row.id,
        action: "bank_confirmed",
        registration_id: row.matched_registration_id,
        amount: Number(row.amount),
        details: { payout_id: next.payoutId, bank_line_id: next.bankLineId, bank_date: next.bankDate },
        actor_id: actorId,
      })
    } else if (!next.bankLineId && row.bank_line_id) {
      events.push({
        run_id: runId,
        item_type: "stripe",
        item_id: row.id,
        action: "bank_unconfirmed",
        registration_id: row.matched_registration_id,
        amount: Number(row.amount),
        details: { payout_id: next.payoutId || null, previous_bank_line_id: row.bank_line_id },
        actor_id: actorId,
      })
    }
  }

  for (const { values, ids } of groups.values()) {
    for (const batch of chunk(ids)) {
      const { error } = await admin
        .from("stripe_balance_transactions")
        .update({
          payout_id: values.payoutId,
          bank_line_id: values.bankLineId,
          bank_received_date: values.bankDate,
        })
        .in("id", batch)
      if (error) throw new Error(error.message)
    }
  }
  await insertEvents(admin, events)
  return confirmed
}

const getActorName = async (admin: AdminClient, actorId: string) => {
  const { data } = await admin.from("users").select("name").eq("id", actorId).maybeSingle()
  return (data?.name as string | undefined) || "an admin"
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const startRun = async (
  admin: AdminClient,
  source: ReconciliationRunSource,
  actorId: string,
  file?: { name: string; text: string }
) => {
  const lockSince = new Date(Date.now() - RUN_LOCK_MINUTES * 60_000).toISOString()
  const { data: running } = await admin
    .from("reconciliation_runs")
    .select("id")
    .eq("status", "processing")
    .gte("created_at", lockSince)
    .limit(1)
  if (running && running.length > 0) {
    throw new ReconciliationConflictError(
      "Another reconciliation is still running. Please wait a moment and try again."
    )
  }

  const { data, error } = await admin
    .from("reconciliation_runs")
    .insert({
      source,
      filename: file?.name ?? null,
      file_sha256: file ? createHash("sha256").update(file.text).digest("hex") : null,
      created_by: actorId,
    })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "Could not start reconciliation run")
  return data.id as string
}

const finishRun = async (
  admin: AdminClient,
  runId: string,
  counters: RunCounters,
  failure?: string
) => {
  await admin
    .from("reconciliation_runs")
    .update({
      status: failure ? "failed" : "completed",
      rows_in_file: counters.rowsInFile,
      new_rows: counters.newRows,
      skipped_rows: counters.skippedRows,
      rechecked_rows: counters.recheckedRows,
      matched: counters.matched,
      unmatched: counters.unmatched,
      not_applicable: counters.notApplicable,
      payments_applied: counters.paymentsApplied,
      amount_applied: counters.amountAppliedCents / 100,
      bank_confirmed: counters.bankConfirmed,
      error: failure ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId)
}

const loadRunView = async (admin: AdminClient, runId: string): Promise<ReconciliationRunView> => {
  const { data, error } = await admin.from("reconciliation_runs").select("*").eq("id", runId).single()
  if (error || !data) throw new Error(error?.message ?? "Run not found")
  const createdByName = data.created_by ? await getActorName(admin, data.created_by) : null
  return toRunView(data, createdByName)
}

const toRunView = (row: Record<string, unknown>, createdByName: string | null): ReconciliationRunView => ({
  id: String(row.id),
  source: row.source as ReconciliationRunSource,
  filename: (row.filename as string | null) ?? null,
  status: row.status as ReconciliationRunView["status"],
  rowsInFile: Number(row.rows_in_file ?? 0),
  newRows: Number(row.new_rows ?? 0),
  skippedRows: Number(row.skipped_rows ?? 0),
  recheckedRows: Number(row.rechecked_rows ?? 0),
  matched: Number(row.matched ?? 0),
  unmatched: Number(row.unmatched ?? 0),
  notApplicable: Number(row.not_applicable ?? 0),
  paymentsApplied: Number(row.payments_applied ?? 0),
  amountApplied: Number(row.amount_applied ?? 0),
  bankConfirmed: Number(row.bank_confirmed ?? 0),
  error: (row.error as string | null) ?? null,
  createdByName,
  createdAt: String(row.created_at),
})

/** Runs `work` inside a recorded run; failures are stored on the run and logged. */
const withRun = async (
  source: ReconciliationRunSource,
  actorId: string,
  request: NextRequest | undefined,
  file: { name: string; text: string } | undefined,
  work: (admin: AdminClient, runId: string, counters: RunCounters) => Promise<void>
) => {
  const admin = createAdminClient()
  const runId = await startRun(admin, source, actorId, file)
  const counters = emptyCounters()
  try {
    await work(admin, runId, counters)
    counters.bankConfirmed = await syncStripeSettlement(admin, runId, actorId)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reconciliation failed"
    await finishRun(admin, runId, counters, message)
    await insertEvents(admin, [
      { run_id: runId, item_type: null, item_id: null, action: "run_failed", comment: message, actor_id: actorId },
    ]).catch(() => undefined)
    await writeAuditLog({
      userId: actorId,
      action: "payment.reconcile_run_failed",
      metadata: { run_id: runId, source, filename: file?.name ?? null, error: message },
      request,
    })
    throw err
  }

  await finishRun(admin, runId, counters)
  await insertEvents(admin, [
    {
      run_id: runId,
      item_type: null,
      item_id: null,
      action: "run_completed",
      details: { source, filename: file?.name ?? null, ...counters },
      actor_id: actorId,
    },
  ])
  await writeAuditLog({
    userId: actorId,
    action: "payment.reconcile_run",
    updatedValue: { run_id: runId, source, filename: file?.name ?? null, ...counters },
    request,
  })
  return loadRunView(admin, runId)
}

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

const loadStripeMatchContext = async (
  admin: AdminClient,
  registrations: RegistrationRef[]
): Promise<StripeMatchContext> => {
  const recorded = await selectAll<{ id: string; registration_id: string; amount: number | string }>(
    (from, to) =>
      admin.from("payments").select("id, registration_id, amount").eq("source", "stripe").range(from, to)
  )
  const linked = await selectAll<{ payment_id: string }>((from, to) =>
    admin
      .from("stripe_balance_transactions")
      .select("payment_id")
      .not("payment_id", "is", null)
      .range(from, to)
  )
  return buildStripeMatchContext(
    registrations,
    recorded.map((p) => ({ id: p.id, registrationId: p.registration_id, amountCents: toCents(p.amount) })),
    new Set(linked.map((l) => l.payment_id))
  )
}

/** Re-evaluates stored Unmatched Stripe rows that no admin has overridden. */
const recheckStripeRows = async (
  admin: AdminClient,
  runId: string,
  actorId: string,
  counters: RunCounters,
  context: StripeMatchContext,
  excludeIds: Set<string> = new Set()
) => {
  const open = (
    await selectAll<StripeRow>((from, to) =>
      admin
        .from("stripe_balance_transactions")
        .select(STRIPE_COLUMNS)
        .eq("status", "unmatched")
        .eq("manual_override", false)
        .order("created_utc")
        .range(from, to)
    )
  ).filter((row) => !excludeIds.has(row.id))

  const events: EventInsert[] = []
  for (const row of open) {
    counters.recheckedRows += 1
    const outcome = matchStripeRow(
      {
        type: row.type,
        amountCents: toCents(row.amount),
        metadataRegistrationId: row.metadata_registration_id,
        metadataParticipantReference: row.metadata_participant_reference,
      },
      context
    )
    countStatus(counters, outcome.status)
    const changed =
      outcome.status !== row.status ||
      outcome.reason !== row.status_reason ||
      outcome.registrationId !== row.matched_registration_id ||
      outcome.paymentId !== row.payment_id
    if (!changed) continue

    const { error } = await admin
      .from("stripe_balance_transactions")
      .update({
        status: outcome.status,
        status_reason: outcome.reason,
        match_method: outcome.method,
        matched_registration_id: outcome.registrationId,
        payment_id: outcome.paymentId,
        last_run_id: runId,
      })
      .eq("id", row.id)
      .eq("status", "unmatched")
      .eq("manual_override", false)
    if (error) throw new Error(error.message)
    events.push({
      run_id: runId,
      item_type: "stripe",
      item_id: row.id,
      action: "rechecked",
      from_status: row.status,
      to_status: outcome.status,
      registration_id: outcome.registrationId,
      amount: Number(row.amount),
      details: { reason: outcome.reason },
      actor_id: actorId,
    })
  }
  await insertEvents(admin, events)
}

export const importStripeCsv = async (params: {
  text: string
  filename: string
  actorId: string
  request?: NextRequest
}) =>
  withRun("stripe", params.actorId, params.request, { name: params.filename, text: params.text }, async (admin, runId, counters) => {
    const parsed = parseStripeBalanceHistory(params.text)
    if (parsed.length === 0) throw new ReconciliationFileError("The file has no transactions.")
    const unique = [...new Map(parsed.map((row) => [row.stripeTxnId, row])).values()]
    counters.rowsInFile = unique.length

    const existing = new Map<string, Pick<StripeRow, "id" | "status" | "manual_override">>()
    for (const ids of chunk(unique.map((r) => r.stripeTxnId))) {
      const { data, error } = await admin
        .from("stripe_balance_transactions")
        .select("id, stripe_txn_id, status, manual_override")
        .in("stripe_txn_id", ids)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) existing.set(row.stripe_txn_id, row)
    }
    counters.skippedRows = [...existing.values()].filter((row) => !isOpenForAutoMatch(row)).length

    const registrations = (await loadRegistrations(admin)).map(toRegistrationRef)
    const context = await loadStripeMatchContext(admin, registrations)
    await recheckStripeRows(admin, runId, params.actorId, counters, context)

    const fresh = unique.filter((row) => !existing.has(row.stripeTxnId))
    counters.newRows = fresh.length
    const inserts = fresh.map((row) => {
      const outcome = matchStripeRow(row, context)
      countStatus(counters, outcome.status)
      return {
        stripe_txn_id: row.stripeTxnId,
        type: row.type,
        source_id: row.sourceId,
        amount: row.amountCents / 100,
        fee: row.feeCents / 100,
        net: row.netCents / 100,
        currency: row.currency,
        created_utc: row.createdUtc,
        available_on_utc: row.availableOnUtc,
        metadata_registration_id: row.metadataRegistrationId,
        metadata_participant_reference: row.metadataParticipantReference,
        status: outcome.status,
        status_reason: outcome.reason,
        match_method: outcome.method,
        matched_registration_id: outcome.registrationId,
        payment_id: outcome.paymentId,
        first_run_id: runId,
        last_run_id: runId,
        raw: row.raw,
      }
    })

    for (const batch of chunk(inserts, 500)) {
      const { data, error } = await admin
        .from("stripe_balance_transactions")
        .upsert(batch, { onConflict: "stripe_txn_id", ignoreDuplicates: true })
        .select("id, status, matched_registration_id, amount")
      if (error) throw new Error(error.message)
      await insertEvents(
        admin,
        (data ?? []).map((row) => ({
          run_id: runId,
          item_type: "stripe" as const,
          item_id: row.id,
          action: "imported",
          to_status: row.status,
          registration_id: row.matched_registration_id,
          amount: Number(row.amount),
          actor_id: params.actorId,
        }))
      )
    }

    // New payouts may settle Direct Credits from STRIPE already on a bank statement.
    await recheckBankLines(admin, runId, params.actorId, counters, params.request, { onlyKind: "stripe_payout" })
  })

// ---------------------------------------------------------------------------
// Bank
// ---------------------------------------------------------------------------

type BankMatchContext = {
  registrations: RegistrationRef[]
  payouts: PayoutSummary[]
  takenPayoutIds: Set<string>
  coverage: StripeCoverage
}

const loadBankMatchContext = async (admin: AdminClient): Promise<BankMatchContext> => {
  const registrations = (await loadRegistrations(admin)).map(toRegistrationRef)
  const stripeRows = await loadAllStripeRows(admin)
  const { payouts } = assignPayouts(toPayoutInputs(stripeRows))
  const createdTimes = stripeRows.map((r) => r.created_utc).sort((a, b) => Date.parse(a) - Date.parse(b))
  const coverage: StripeCoverage = {
    earliestCreatedUtc: createdTimes[0] ?? null,
    latestCreatedUtc: createdTimes[createdTimes.length - 1] ?? null,
  }
  const taken = await selectAll<{ matched_stripe_payout_id: string }>((from, to) =>
    admin
      .from("bank_statement_lines")
      .select("matched_stripe_payout_id")
      .neq("matched_stripe_payout_id", "")
      .range(from, to)
  )
  return {
    registrations,
    payouts,
    takenPayoutIds: new Set(taken.map((t) => t.matched_stripe_payout_id)),
    coverage,
  }
}

type PendingEmail = { registrationId: string }

const sendPaymentReceivedEmails = async (pending: PendingEmail[], request?: NextRequest) => {
  if (!request) return
  const uniqueIds = [...new Set(pending.map((p) => p.registrationId))]
  for (const registrationId of uniqueIds) {
    try {
      const full = await getRegistrationWithAttendees(registrationId)
      if (full) await sendRegistrationEmail(full, "payment_received", { request })
    } catch (err) {
      console.error("[reconcile] payment received email failed", registrationId, err)
    }
  }
}

/** Matches one open bank line; transfers that match are applied to the registration. */
const evaluateBankLine = async (
  admin: AdminClient,
  line: BankRow,
  context: BankMatchContext,
  runId: string,
  actorId: string,
  counters: RunCounters,
  events: EventInsert[],
  emails: PendingEmail[],
  request?: NextRequest
) => {
  const input = {
    transactionDate: line.transaction_date,
    amountCents: toCents(line.amount),
    description: line.description,
  }
  const previousStatus = line.status

  if (line.kind === "stripe_payout") {
    const outcome = matchBankPayoutLine(input, context.payouts, context.takenPayoutIds, context.coverage)
    if (outcome.payoutId) context.takenPayoutIds.add(outcome.payoutId)
    countStatus(counters, outcome.status)
    if (
      outcome.status === line.status &&
      outcome.reason === line.status_reason &&
      (outcome.payoutId ?? "") === line.matched_stripe_payout_id
    ) {
      return
    }
    const { error } = await admin
      .from("bank_statement_lines")
      .update({
        status: outcome.status,
        status_reason: outcome.reason,
        match_method: outcome.method,
        matched_stripe_payout_id: outcome.payoutId ?? "",
        last_run_id: runId,
      })
      .eq("id", line.id)
      .eq("status", "unmatched")
      .eq("manual_override", false)
    if (error) throw new Error(error.message)
    events.push({
      run_id: runId,
      item_type: "bank",
      item_id: line.id,
      action: "rechecked",
      from_status: previousStatus,
      to_status: outcome.status,
      amount: Number(line.amount),
      details: { reason: outcome.reason, payout_id: outcome.payoutId },
      actor_id: actorId,
    })
    return
  }

  const outcome: MatchOutcome = matchBankTransferLine(input, context.registrations)
  if (outcome.status !== "matched" || !outcome.registrationId) {
    countStatus(counters, outcome.status)
    if (
      outcome.status === line.status &&
      outcome.reason === line.status_reason &&
      outcome.registrationId === line.matched_registration_id
    ) {
      return
    }
    const { error } = await admin
      .from("bank_statement_lines")
      .update({
        status: outcome.status,
        status_reason: outcome.reason,
        match_method: outcome.method,
        matched_registration_id: outcome.registrationId,
        last_run_id: runId,
      })
      .eq("id", line.id)
      .eq("status", "unmatched")
      .eq("manual_override", false)
    if (error) throw new Error(error.message)
    events.push({
      run_id: runId,
      item_type: "bank",
      item_id: line.id,
      action: "rechecked",
      from_status: previousStatus,
      to_status: outcome.status,
      registration_id: outcome.registrationId,
      amount: Number(line.amount),
      details: { reason: outcome.reason },
      actor_id: actorId,
    })
    return
  }

  // Claim the line first so a concurrent run can never apply the same transfer twice.
  const { data: claimed, error: claimError } = await admin
    .from("bank_statement_lines")
    .update({
      status: "matched",
      status_reason: outcome.reason,
      match_method: outcome.method,
      matched_registration_id: outcome.registrationId,
      last_run_id: runId,
    })
    .eq("id", line.id)
    .eq("status", "unmatched")
    .eq("manual_override", false)
    .select("id")
  if (claimError) throw new Error(claimError.message)
  if (!claimed || claimed.length === 0) return

  try {
    const applied = await applyBankLinePayment({
      lineId: line.id,
      registrationId: outcome.registrationId,
      amount: Number(line.amount),
      description: line.description,
      actorId,
      request,
    })
    const reason = `${outcome.reason} Payment of ${formatCents(toCents(applied.amount))} applied — registration now ${formatPaymentStatus(applied.paymentStatus)}.`
    await admin.from("bank_statement_lines").update({ status_reason: reason }).eq("id", line.id)
    counters.matched += 1
    counters.paymentsApplied += 1
    counters.amountAppliedCents += toCents(applied.amount)
    events.push(
      {
        run_id: runId,
        item_type: "bank",
        item_id: line.id,
        action: "rechecked",
        from_status: previousStatus,
        to_status: "matched",
        registration_id: outcome.registrationId,
        amount: applied.amount,
        details: { reason: outcome.reason },
        actor_id: actorId,
      },
      {
        run_id: runId,
        item_type: "bank",
        item_id: line.id,
        action: "payment_applied",
        registration_id: outcome.registrationId,
        amount: applied.amount,
        details: { payment_id: applied.paymentId, payment_status: applied.paymentStatus },
        actor_id: actorId,
      }
    )
    emails.push({ registrationId: outcome.registrationId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    await admin
      .from("bank_statement_lines")
      .update({
        status: "unmatched",
        status_reason: `${outcome.reason} The payment could not be applied (${message}) — re-check or override.`,
      })
      .eq("id", line.id)
    counters.unmatched += 1
    events.push({
      run_id: runId,
      item_type: "bank",
      item_id: line.id,
      action: "payment_apply_failed",
      registration_id: outcome.registrationId,
      amount: Number(line.amount),
      comment: message,
      actor_id: actorId,
    })
  }
}

/** Re-evaluates stored Unmatched bank lines that no admin has overridden. */
const recheckBankLines = async (
  admin: AdminClient,
  runId: string,
  actorId: string,
  counters: RunCounters,
  request: NextRequest | undefined,
  options: { onlyKind?: BankLineKind } = {}
) => {
  let query = admin
    .from("bank_statement_lines")
    .select(BANK_COLUMNS)
    .eq("status", "unmatched")
    .eq("manual_override", false)
    .neq("kind", "debit")
  if (options.onlyKind) query = query.eq("kind", options.onlyKind)
  const { data, error } = await query.order("transaction_date").order("created_at")
  if (error) throw new Error(error.message)
  const open = (data ?? []) as BankRow[]
  if (open.length === 0) return

  const context = await loadBankMatchContext(admin)
  const events: EventInsert[] = []
  const emails: PendingEmail[] = []
  for (const line of open) {
    counters.recheckedRows += 1
    await evaluateBankLine(admin, line, context, runId, actorId, counters, events, emails, request)
  }
  await insertEvents(admin, events)
  await sendPaymentReceivedEmails(emails, request)
}

export const importBankCsv = async (params: {
  text: string
  filename: string
  actorId: string
  request?: NextRequest
}) =>
  withRun("bank", params.actorId, params.request, { name: params.filename, text: params.text }, async (admin, runId, counters) => {
    const parsed = parseCbaStatement(params.text)
    if (parsed.length === 0) throw new ReconciliationFileError("The file has no transactions.")
    counters.rowsInFile = parsed.length

    const existing = new Map<string, Pick<BankRow, "id" | "status" | "manual_override">>()
    for (const fingerprints of chunk(parsed.map((l) => l.fingerprint))) {
      const { data, error } = await admin
        .from("bank_statement_lines")
        .select("id, fingerprint, status, manual_override")
        .in("fingerprint", fingerprints)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) existing.set(row.fingerprint, row)
    }
    counters.skippedRows = [...existing.values()].filter((row) => !isOpenForAutoMatch(row)).length

    const unseen = parsed.filter((line) => !existing.has(line.fingerprint))
    const storedCounts = new Map<string, number>()
    for (const dates of chunk([...new Set(unseen.map((line) => line.transactionDate))])) {
      const { data, error } = await admin
        .from("bank_statement_lines")
        .select("transaction_date, amount, description")
        .in("transaction_date", dates)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) {
        const key = bankLineContentKey(row.transaction_date, toCents(row.amount), row.description)
        storedCounts.set(key, (storedCounts.get(key) ?? 0) + 1)
      }
    }
    const fresh = selectNewBankLines(parsed, unseen, storedCounts)
    counters.skippedRows += unseen.length - fresh.length
    counters.newRows = fresh.length
    const inserts = fresh.map((line) => ({
      fingerprint: line.fingerprint,
      transaction_date: line.transactionDate,
      amount: line.amountCents / 100,
      description: line.description,
      balance: line.balanceCents === null ? null : line.balanceCents / 100,
      kind: line.kind,
      status: line.kind === "debit" ? "not_applicable" : "unmatched",
      status_reason:
        line.kind === "debit" ? "Money out of the CFCA account — not a participant payment." : "Waiting to be matched.",
      first_run_id: runId,
      last_run_id: runId,
      raw: line.raw,
    }))

    for (const batch of chunk(inserts, 500)) {
      const { data, error } = await admin
        .from("bank_statement_lines")
        .upsert(batch, { onConflict: "fingerprint", ignoreDuplicates: true })
        .select("id, status, amount")
      if (error) throw new Error(error.message)
      for (const row of data ?? []) if (row.status === "not_applicable") counters.notApplicable += 1
      await insertEvents(
        admin,
        (data ?? []).map((row) => ({
          run_id: runId,
          item_type: "bank" as const,
          item_id: row.id,
          action: "imported",
          to_status: row.status,
          amount: Number(row.amount),
          actor_id: params.actorId,
        }))
      )
    }

    await recheckBankLines(admin, runId, params.actorId, counters, params.request)
    counters.recheckedRows = Math.max(0, counters.recheckedRows - fresh.filter((l) => l.kind !== "debit").length)
  })

export const recheckUnmatched = async (params: { actorId: string; request?: NextRequest }) =>
  withRun("recheck", params.actorId, params.request, undefined, async (admin, runId, counters) => {
    const registrations = (await loadRegistrations(admin)).map(toRegistrationRef)
    const context = await loadStripeMatchContext(admin, registrations)
    await recheckStripeRows(admin, runId, params.actorId, counters, context)
    await recheckBankLines(admin, runId, params.actorId, counters, params.request)
  })

// ---------------------------------------------------------------------------
// Admin overrides
// ---------------------------------------------------------------------------

export class ReconciliationValidationError extends Error {}

const MIN_COMMENT_LENGTH = 3

export const overrideReconciliationItem = async (params: {
  input: ReconciliationOverrideRequest
  actorId: string
  request?: NextRequest
}) => {
  const { input, actorId, request } = params
  const comment = input.comment.trim()
  if (comment.length < MIN_COMMENT_LENGTH) {
    throw new ReconciliationValidationError("Please add a comment explaining the change.")
  }

  const admin = createAdminClient()
  const actorName = await getActorName(admin, actorId)
  const now = new Date().toISOString()
  const action = input.status === "ignored" ? "ignored" : "status_override"
  const reasonText = `${RECONCILIATION_STATUS_LABELS[input.status]} — set by ${actorName}.`
  const events: EventInsert[] = []

  if (input.itemType === "stripe") {
    const { data: row } = await admin
      .from("stripe_balance_transactions")
      .select(STRIPE_COLUMNS)
      .eq("id", input.itemId)
      .maybeSingle()
    if (!row) throw new ReconciliationValidationError("Stripe row not found.")
    const item = row as StripeRow
    const kind = classifyStripeType(item.type)
    const registrationId = input.registrationId || item.matched_registration_id
    const needsRegistration = kind === "payment" || kind === "refund"

    if (input.status === "matched" && needsRegistration && !registrationId) {
      throw new ReconciliationValidationError("Choose the participant this Stripe payment belongs to.")
    }

    let paymentId: string | null = null
    if (input.status === "matched" && registrationId && kind === "payment") {
      const registrations = (await loadRegistrations(admin)).map(toRegistrationRef)
      const context = await loadStripeMatchContext(admin, registrations)
      if (item.payment_id) paymentId = item.payment_id
      else {
        const pool = context.unlinkedPayments.get(registrationId) ?? []
        paymentId = pool.find((p) => p.amountCents === toCents(item.amount))?.id ?? null
      }
    }

    const { error } = await admin
      .from("stripe_balance_transactions")
      .update({
        status: input.status,
        status_reason: reasonText,
        match_method: input.status === "matched" ? "manual" : item.match_method,
        matched_registration_id: input.status === "matched" ? registrationId : item.matched_registration_id,
        payment_id: input.status === "matched" ? paymentId : null,
        manual_override: true,
        status_comment: comment,
        status_updated_by: actorId,
        status_updated_at: now,
      })
      .eq("id", item.id)
    if (error) throw new Error(error.message)

    events.push({
      run_id: null,
      item_type: "stripe",
      item_id: item.id,
      action,
      from_status: item.status,
      to_status: input.status,
      registration_id: input.status === "matched" ? registrationId : item.matched_registration_id,
      amount: Number(item.amount),
      comment,
      details: { payment_id: paymentId },
      actor_id: actorId,
    })
    await insertEvents(admin, events)
    await writeAuditLog({
      userId: actorId,
      action: "payment.reconcile_override",
      previousValue: { status: item.status, matched_registration_id: item.matched_registration_id },
      updatedValue: { status: input.status, matched_registration_id: registrationId ?? null },
      metadata: { item_type: "stripe", item_id: item.id, stripe_txn_id: item.stripe_txn_id, comment },
      request,
    })
    return
  }

  const { data: row } = await admin
    .from("bank_statement_lines")
    .select(BANK_COLUMNS)
    .eq("id", input.itemId)
    .maybeSingle()
  if (!row) throw new ReconciliationValidationError("Bank statement line not found.")
  const line = row as BankRow
  let registrationId: string | null = line.matched_registration_id
  let payoutId = line.matched_stripe_payout_id
  const emails: PendingEmail[] = []

  if (line.kind === "transfer") {
    registrationId = input.status === "matched" ? input.registrationId || line.matched_registration_id : line.matched_registration_id
    if (input.status === "matched" && !registrationId) {
      throw new ReconciliationValidationError("Choose the participant this bank transfer belongs to.")
    }

    const applied = await getAppliedAmountsForLine(line.id)
    const keepApplied =
      input.status === "matched" && applied.size === 1 && applied.has(registrationId as string)
    if (applied.size > 0 && !keepApplied) {
      const reversed = await reverseBankLinePayments({
        lineId: line.id,
        description: line.description,
        actorId,
        request,
      })
      for (const r of reversed) {
        events.push({
          run_id: null,
          item_type: "bank",
          item_id: line.id,
          action: "payment_reversed",
          registration_id: r.registrationId,
          amount: -r.amount,
          comment,
          details: { payment_status: r.paymentStatus },
          actor_id: actorId,
        })
      }
    }
    if (input.status === "matched" && registrationId && !keepApplied) {
      const result = await applyBankLinePayment({
        lineId: line.id,
        registrationId,
        amount: Number(line.amount),
        description: line.description,
        actorId,
        request,
      })
      events.push({
        run_id: null,
        item_type: "bank",
        item_id: line.id,
        action: "payment_applied",
        registration_id: registrationId,
        amount: result.amount,
        comment,
        details: { payment_id: result.paymentId, payment_status: result.paymentStatus },
        actor_id: actorId,
      })
      emails.push({ registrationId })
    }
  } else if (line.kind === "stripe_payout") {
    if (input.status === "matched") {
      payoutId = input.payoutId || line.matched_stripe_payout_id
      if (!payoutId) throw new ReconciliationValidationError("Choose the Stripe payout this Direct Credit belongs to.")
      const { data: payoutRow } = await admin
        .from("stripe_balance_transactions")
        .select("id")
        .eq("type", "payout")
        .eq("source_id", payoutId)
        .maybeSingle()
      if (!payoutRow) throw new ReconciliationValidationError("That Stripe payout is not in the uploaded Stripe exports.")
      const { data: takenBy } = await admin
        .from("bank_statement_lines")
        .select("id")
        .eq("matched_stripe_payout_id", payoutId)
        .neq("id", line.id)
        .limit(1)
      if (takenBy && takenBy.length > 0) {
        throw new ReconciliationValidationError("That Stripe payout is already matched to another bank line.")
      }
    } else {
      payoutId = ""
    }
  }

  const { error } = await admin
    .from("bank_statement_lines")
    .update({
      status: input.status,
      status_reason: reasonText,
      match_method: input.status === "matched" ? "manual" : line.match_method,
      matched_registration_id: registrationId,
      matched_stripe_payout_id: payoutId,
      manual_override: true,
      status_comment: comment,
      status_updated_by: actorId,
      status_updated_at: now,
    })
    .eq("id", line.id)
  if (error) throw new Error(error.message)

  events.push({
    run_id: null,
    item_type: "bank",
    item_id: line.id,
    action,
    from_status: line.status,
    to_status: input.status,
    registration_id: registrationId,
    amount: Number(line.amount),
    comment,
    details: { payout_id: payoutId || null },
    actor_id: actorId,
  })
  await insertEvents(admin, events)
  await writeAuditLog({
    userId: actorId,
    action: "payment.reconcile_override",
    previousValue: {
      status: line.status,
      matched_registration_id: line.matched_registration_id,
      matched_stripe_payout_id: line.matched_stripe_payout_id || null,
    },
    updatedValue: {
      status: input.status,
      matched_registration_id: registrationId,
      matched_stripe_payout_id: payoutId || null,
    },
    metadata: { item_type: "bank", item_id: line.id, comment },
    request,
  })
  if (line.kind === "stripe_payout") await syncStripeSettlement(admin, null, actorId)
  await sendPaymentReceivedEmails(emails, request)
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const EVENT_LIMIT = 500
const RUN_LIMIT = 100

export const loadItemHistory = async (
  itemType: ReconciliationItemType,
  itemId: string
): Promise<ReconciliationEventView[]> => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("reconciliation_events")
    .select("*")
    .eq("item_type", itemType)
    .eq("item_id", itemId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  const events = data ?? []
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))] as string[]
  const userNames = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: users } = await admin.from("users").select("id, name").in("id", actorIds)
    for (const u of users ?? []) userNames.set(u.id, u.name)
  }
  return events.map((e) => ({
    id: e.id,
    runId: e.run_id,
    itemType: e.item_type,
    itemId: e.item_id,
    itemLabel: "",
    action: e.action,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    registrationId: e.registration_id,
    amount: e.amount === null ? null : Number(e.amount),
    comment: e.comment,
    actorName: e.actor_id ? userNames.get(e.actor_id) ?? null : null,
    createdAt: e.created_at,
  }))
}

export const loadReconciledAmounts = async (): Promise<ReconciledAmountsResponse> => {
  const admin = createAdminClient()
  const [bankPayments, stripeRows] = await Promise.all([
    selectAll<{ registration_id: string; amount: number | string }>((from, to) =>
      admin
        .from("payments")
        .select("registration_id, amount")
        .not("reconciliation_bank_line_id", "is", null)
        .range(from, to)
    ),
    selectAll<{
      matched_registration_id: string
      type: string
      net: number | string
      fee: number | string
      status: string
      bank_line_id: string
    }>((from, to) =>
      admin
        .from("stripe_balance_transactions")
        .select("matched_registration_id, type, net, fee, status, bank_line_id")
        .eq("status", "matched")
        .not("matched_registration_id", "is", null)
        .not("bank_line_id", "is", null)
        .range(from, to)
    ),
  ])

  return {
    amounts: summarizeReconciledAmounts(
      bankPayments.map((p) => ({ registrationId: p.registration_id, amount: p.amount })),
      stripeRows.map((r) => ({
        registrationId: r.matched_registration_id,
        type: r.type,
        net: r.net,
        fee: r.fee,
        status: r.status,
        bankLineId: r.bank_line_id,
      }))
    ),
  }
}

export const loadReconciliationOverview = async (): Promise<ReconciliationOverview> => {
  const admin = createAdminClient()
  const [runsResult, stripeRows, bankRows, appliedRows, eventsResult, registrations] = await Promise.all([
    admin.from("reconciliation_runs").select("*").order("created_at", { ascending: false }).limit(RUN_LIMIT),
    loadAllStripeRows(admin),
    loadAllBankRows(admin),
    selectAll<{ reconciliation_bank_line_id: string; amount: number | string }>((from, to) =>
      admin
        .from("payments")
        .select("reconciliation_bank_line_id, amount")
        .not("reconciliation_bank_line_id", "is", null)
        .range(from, to)
    ),
    admin.from("reconciliation_events").select("*").order("created_at", { ascending: false }).limit(EVENT_LIMIT),
    loadRegistrations(admin),
  ])
  if (runsResult.error) throw new Error(runsResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  const runs = runsResult.data ?? []
  const events = eventsResult.data ?? []

  const userIds = new Set<string>()
  for (const r of runs) if (r.created_by) userIds.add(r.created_by)
  for (const r of stripeRows) if (r.status_updated_by) userIds.add(r.status_updated_by)
  for (const r of bankRows) if (r.status_updated_by) userIds.add(r.status_updated_by)
  for (const e of events) if (e.actor_id) userIds.add(e.actor_id)
  const userNames = new Map<string, string>()
  for (const ids of chunk([...userIds])) {
    const { data } = await admin.from("users").select("id, name").in("id", ids)
    for (const u of data ?? []) userNames.set(u.id, u.name)
  }
  const nameOf = (id: string | null | undefined) => (id ? userNames.get(id) ?? null : null)

  const appliedByLine = new Map<string, number>()
  for (const p of appliedRows) {
    appliedByLine.set(
      p.reconciliation_bank_line_id,
      (appliedByLine.get(p.reconciliation_bank_line_id) ?? 0) + toCents(p.amount)
    )
  }

  const { payouts, payoutByTxn } = assignPayouts(toPayoutInputs(stripeRows))
  const bankByPayout = new Map(
    bankRows.filter((b) => b.matched_stripe_payout_id).map((b) => [b.matched_stripe_payout_id, b])
  )

  const stripe = stripeRows.map((r) => {
    const isPayout = classifyStripeType(r.type) === "payout"
    const payout = isPayout
      ? payouts.find((p) => p.stripeTxnId === r.stripe_txn_id) ?? null
      : payoutByTxn.get(r.stripe_txn_id) ?? null
    return {
      id: r.id,
      stripeTxnId: r.stripe_txn_id,
      type: r.type,
      sourceId: r.source_id,
      amount: Number(r.amount),
      fee: Number(r.fee),
      net: Number(r.net),
      currency: r.currency,
      createdUtc: r.created_utc,
      availableOnUtc: r.available_on_utc,
      metadataRegistrationId: r.metadata_registration_id,
      metadataParticipantReference: r.metadata_participant_reference,
      status: r.status,
      statusReason: r.status_reason,
      matchMethod: r.match_method,
      matchedRegistrationId: r.matched_registration_id,
      paymentId: r.payment_id,
      manualOverride: r.manual_override,
      statusComment: r.status_comment,
      statusUpdatedByName: nameOf(r.status_updated_by),
      statusUpdatedAt: r.status_updated_at,
      payoutId: payout?.payoutId ?? null,
      payoutCreatedUtc: payout?.createdUtc ?? null,
      settledBankDate: r.bank_received_date,
      bankLineId: r.bank_line_id,
      bankSettlement: (r.bank_line_id ? "received" : payout ? "awaiting_bank" : "not_paid_out") as BankSettlement,
    }
  })

  const bank = bankRows.map((b) => ({
    id: b.id,
    transactionDate: b.transaction_date,
    amount: Number(b.amount),
    description: b.description,
    balance: b.balance === null ? null : Number(b.balance),
    kind: b.kind,
    status: b.status,
    statusReason: b.status_reason,
    matchMethod: b.match_method,
    matchedRegistrationId: b.matched_registration_id,
    matchedStripePayoutId: b.matched_stripe_payout_id || null,
    awaitingStripeExport:
      b.kind === "stripe_payout" && b.status === "unmatched" && b.match_method === AWAITING_STRIPE_EXPORT_METHOD,
    appliedAmount: (appliedByLine.get(b.id) ?? 0) / 100,
    manualOverride: b.manual_override,
    statusComment: b.status_comment,
    statusUpdatedByName: nameOf(b.status_updated_by),
    statusUpdatedAt: b.status_updated_at,
  }))

  const payoutViews = payouts
    .map((p) => {
      const line = bankByPayout.get(p.payoutId)
      return {
        payoutId: p.payoutId,
        stripeTxnId: p.stripeTxnId,
        createdUtc: p.createdUtc,
        amount: p.amountCents / 100,
        transactionCount: p.transactionCount,
        coveredNet: p.coveredNetCents / 100,
        difference: (p.amountCents - p.coveredNetCents) / 100,
        bankLineId: line?.id ?? null,
        bankDate: line?.transaction_date ?? null,
      }
    })
    .reverse()

  const stripeLabels = new Map(stripeRows.map((r) => [r.id, `${r.type} ${r.stripe_txn_id}`]))
  const bankLabels = new Map(
    bankRows.map((b) => [b.id, `${b.transaction_date} · ${formatCents(toCents(b.amount))} · ${b.description}`])
  )

  return {
    runs: runs.map((r) => toRunView(r, nameOf(r.created_by))),
    stripe,
    bank,
    payouts: payoutViews,
    events: events.map((e) => ({
      id: e.id,
      runId: e.run_id,
      itemType: e.item_type,
      itemId: e.item_id,
      itemLabel:
        e.item_type === "stripe"
          ? stripeLabels.get(e.item_id) ?? "Stripe row"
          : e.item_type === "bank"
            ? bankLabels.get(e.item_id) ?? "Bank line"
            : "Run",
      action: e.action,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      registrationId: e.registration_id,
      amount: e.amount === null ? null : Number(e.amount),
      comment: e.comment,
      actorName: nameOf(e.actor_id),
      createdAt: e.created_at,
    })),
    registrations: registrations.map((r) => ({
      id: r.id,
      registrationNo: r.registration_no,
      participantReference: r.participant_reference ?? "",
      name: `${r.given_name} ${r.surname}`.trim(),
      amountDue: Number(r.amount_due),
      amountPaid: Number(r.amount_paid),
      paymentStatus: r.payment_status,
    })),
  }
}
