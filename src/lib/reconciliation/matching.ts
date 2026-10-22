import type { ReconciliationStatus } from "@/lib/reconciliation/types"

export const formatCents = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100)

export const toCents = (value: number | string | null | undefined) =>
  Math.round(Number(value ?? 0) * 100)

export const normalizeReference = (value: string | null | undefined) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")

const MELBOURNE_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** YYYY-MM-DD in Melbourne time (CBA statement dates are local). */
export const melbourneDate = (iso: string) => MELBOURNE_DATE.format(new Date(iso))

const dayNumber = (isoDate: string) => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000)

export const daysBetween = (fromDate: string, toDate: string) => dayNumber(toDate) - dayNumber(fromDate)

const formatDisplayDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

export type RegistrationRef = {
  id: string
  registrationNo: string
  participantReference: string
  createdAt: string
}

export type MatchOutcome = {
  status: ReconciliationStatus
  reason: string
  method: string
  registrationId: string | null
}

const refLabel = (registration: RegistrationRef) =>
  registration.participantReference || registration.registrationNo

/** Registrations whose Unique Code or registration number appears in the text (ignoring spaces, _ and -). */
export const findRegistrationCandidates = (
  text: string,
  registrations: RegistrationRef[]
): { registration: RegistrationRef; matchedOn: string }[] => {
  const haystack = normalizeReference(text)
  const hits: { registration: RegistrationRef; matchedOn: string }[] = []

  for (const registration of registrations) {
    const refs = [registration.participantReference, registration.registrationNo]
      .map(normalizeReference)
      .filter((ref) => ref.length >= 6)
    const matchedOn = refs.find((ref) => haystack.includes(ref))
    if (matchedOn) hits.push({ registration, matchedOn })
  }

  return hits.filter(
    (hit) =>
      !hits.some(
        (other) =>
          other !== hit &&
          other.matchedOn.length > hit.matchedOn.length &&
          other.matchedOn.includes(hit.matchedOn)
      )
  )
}

const STRIPE_PAYMENT_TYPES = new Set(["payment", "charge"])
const STRIPE_REFUND_TYPES = new Set(["refund", "payment_refund", "partial_capture_reversal"])
const STRIPE_PAYOUT_TYPES = new Set(["payout"])

export type StripeRowKind = "payment" | "refund" | "payout" | "other"

export const classifyStripeType = (type: string): StripeRowKind => {
  const normalized = type.trim().toLowerCase()
  if (STRIPE_PAYMENT_TYPES.has(normalized)) return "payment"
  if (STRIPE_REFUND_TYPES.has(normalized)) return "refund"
  if (STRIPE_PAYOUT_TYPES.has(normalized)) return "payout"
  return "other"
}

export type StripeMatchInput = {
  type: string
  amountCents: number
  metadataRegistrationId: string
  metadataParticipantReference: string
}

export type RecordedStripePayment = { id: string; registrationId: string; amountCents: number }

export type StripeMatchContext = {
  registrationsById: Map<string, RegistrationRef>
  registrationsByReference: Map<string, RegistrationRef>
  /** Stripe payments recorded in the system that are not linked to a Stripe row yet, per registration. */
  unlinkedPayments: Map<string, RecordedStripePayment[]>
}

export const buildStripeMatchContext = (
  registrations: RegistrationRef[],
  recordedPayments: RecordedStripePayment[],
  linkedPaymentIds: Set<string>
): StripeMatchContext => {
  const unlinkedPayments = new Map<string, RecordedStripePayment[]>()
  for (const payment of recordedPayments) {
    if (linkedPaymentIds.has(payment.id)) continue
    const list = unlinkedPayments.get(payment.registrationId) ?? []
    list.push(payment)
    unlinkedPayments.set(payment.registrationId, list)
  }
  return {
    registrationsById: new Map(registrations.map((r) => [r.id, r])),
    registrationsByReference: new Map(
      registrations
        .filter((r) => r.participantReference)
        .map((r) => [normalizeReference(r.participantReference), r])
    ),
    unlinkedPayments,
  }
}

/** Takes the recorded payment it links to out of the pool, so two Stripe rows never share one payment. */
export const matchStripeRow = (
  row: StripeMatchInput,
  context: StripeMatchContext
): MatchOutcome & { paymentId: string | null } => {
  const kind = classifyStripeType(row.type)

  if (kind === "payout") {
    return {
      status: "not_applicable",
      reason: "Payout to the CFCA bank account — reconciled against the CBA statement (Direct Credit from STRIPE).",
      method: "",
      registrationId: null,
      paymentId: null,
    }
  }
  if (kind === "other") {
    return {
      status: "not_applicable",
      reason: `Stripe ${row.type.replace(/_/g, " ") || "adjustment"} — not a participant payment; already deducted from the payout.`,
      method: "",
      registrationId: null,
      paymentId: null,
    }
  }

  const byId = row.metadataRegistrationId
    ? context.registrationsById.get(row.metadataRegistrationId)
    : undefined
  const byReference = row.metadataParticipantReference
    ? context.registrationsByReference.get(normalizeReference(row.metadataParticipantReference))
    : undefined
  const registration = byId ?? byReference
  const method = byId ? "stripe_metadata_registration_id" : byReference ? "stripe_metadata_unique_code" : ""

  if (!registration) {
    const label = row.metadataParticipantReference || row.metadataRegistrationId
    return {
      status: "unmatched",
      reason: label
        ? `No current registration for ${label} — it may have been deleted (e.g. a test payment before go-live).`
        : "No registration details saved on this Stripe payment.",
      method: "",
      registrationId: null,
      paymentId: null,
    }
  }

  if (kind === "refund") {
    return {
      status: "unmatched",
      reason: `Refund for ${refLabel(registration)} — check their Amount paid was reduced, then ignore with a comment.`,
      method,
      registrationId: registration.id,
      paymentId: null,
    }
  }

  const pool = context.unlinkedPayments.get(registration.id) ?? []
  const paymentIndex = pool.findIndex((p) => p.amountCents === row.amountCents)
  if (paymentIndex < 0) {
    return {
      status: "unmatched",
      reason: `Participant ${refLabel(registration)} found, but no Stripe payment of ${formatCents(row.amountCents)} is recorded on their registration.`,
      method,
      registrationId: registration.id,
      paymentId: null,
    }
  }

  const [payment] = pool.splice(paymentIndex, 1)
  return {
    status: "matched",
    reason: `Matched to ${refLabel(registration)} — Stripe payment of ${formatCents(row.amountCents)} is recorded on the registration.`,
    method,
    registrationId: registration.id,
    paymentId: payment.id,
  }
}

export type PayoutAssignmentInput = {
  stripeTxnId: string
  type: string
  sourceId: string
  createdUtc: string
  availableOnUtc: string
  amountCents: number
  netCents: number
}

export type PayoutSummary = {
  payoutId: string
  stripeTxnId: string
  createdUtc: string
  amountCents: number
  transactionCount: number
  coveredNetCents: number
}

/**
 * A payout contains the rows whose funds became available after the previous payout
 * and up to (including) this payout. Rows available after the last payout are awaiting one.
 */
export const assignPayouts = (rows: PayoutAssignmentInput[]) => {
  const payouts = rows
    .filter((r) => classifyStripeType(r.type) === "payout")
    .sort((a, b) => Date.parse(a.createdUtc) - Date.parse(b.createdUtc))

  const summaries: PayoutSummary[] = payouts.map((p) => ({
    payoutId: p.sourceId || p.stripeTxnId,
    stripeTxnId: p.stripeTxnId,
    createdUtc: p.createdUtc,
    amountCents: -p.amountCents,
    transactionCount: 0,
    coveredNetCents: 0,
  }))

  const payoutByTxn = new Map<string, PayoutSummary | null>()
  for (const row of rows) {
    if (classifyStripeType(row.type) === "payout") continue
    const available = Date.parse(row.availableOnUtc)
    const index = payouts.findIndex((p) => Date.parse(p.createdUtc) >= available)
    const summary = index >= 0 ? summaries[index] : null
    if (summary) {
      summary.transactionCount += 1
      summary.coveredNetCents += row.netCents
    }
    payoutByTxn.set(row.stripeTxnId, summary)
  }

  return { payouts: summaries, payoutByTxn }
}

export type SettlementBankLine = { id: string; transactionDate: string; payoutId: string }

export type StripeSettlement = {
  payoutId: string
  bankLineId: string | null
  bankDate: string | null
}

/**
 * Which payout settled each Stripe row and which CBA line received that payout.
 * Derived only from the stored rows, so the result is the same whichever export was uploaded first.
 */
export const computeStripeSettlement = (
  rows: PayoutAssignmentInput[],
  matchedBankLines: SettlementBankLine[]
) => {
  const { payouts, payoutByTxn } = assignPayouts(rows)
  const payoutByOwnTxn = new Map(payouts.map((p) => [p.stripeTxnId, p]))
  const bankByPayout = new Map(matchedBankLines.map((line) => [line.payoutId, line]))
  const settlement = new Map<string, StripeSettlement>()
  for (const row of rows) {
    const payout = payoutByOwnTxn.get(row.stripeTxnId) ?? payoutByTxn.get(row.stripeTxnId) ?? null
    const line = payout ? bankByPayout.get(payout.payoutId) : undefined
    settlement.set(row.stripeTxnId, {
      payoutId: payout?.payoutId ?? "",
      bankLineId: line?.id ?? null,
      bankDate: line?.transactionDate ?? null,
    })
  }
  return settlement
}

export const AWAITING_STRIPE_EXPORT_METHOD = "awaiting_stripe_export"

export type StripeCoverage = { earliestCreatedUtc: string | null; latestCreatedUtc: string | null }

/** True when the uploaded Stripe exports span the days a payout for this bank date would have been made. */
const stripeExportsCover = (bankDate: string, coverage: StripeCoverage) => {
  if (!coverage.earliestCreatedUtc || !coverage.latestCreatedUtc) return false
  return (
    daysBetween(melbourneDate(coverage.earliestCreatedUtc), bankDate) >= PAYOUT_WINDOW_DAYS_AFTER &&
    melbourneDate(coverage.latestCreatedUtc) >= bankDate
  )
}

export type BankLineMatchInput = {
  transactionDate: string
  amountCents: number
  description: string
}

const PAYOUT_WINDOW_DAYS_BEFORE = 1
const PAYOUT_WINDOW_DAYS_AFTER = 7

/** "Direct Credit … STRIPE" → the Stripe payout of the same amount, created up to a week before. */
export const matchBankPayoutLine = (
  line: BankLineMatchInput,
  payouts: PayoutSummary[],
  takenPayoutIds: Set<string>,
  coverage?: StripeCoverage
): MatchOutcome & { payoutId: string | null } => {
  const candidates = payouts
    .filter((p) => !takenPayoutIds.has(p.payoutId) && p.amountCents === line.amountCents)
    .map((p) => ({ payout: p, lag: daysBetween(melbourneDate(p.createdUtc), line.transactionDate) }))
    .filter((c) => c.lag >= -PAYOUT_WINDOW_DAYS_BEFORE && c.lag <= PAYOUT_WINDOW_DAYS_AFTER)
    .sort((a, b) => Math.abs(a.lag) - Math.abs(b.lag))

  if (candidates.length === 0) {
    if (coverage && !stripeExportsCover(line.transactionDate, coverage)) {
      return {
        status: "unmatched",
        reason: `Waiting for the Stripe balance history covering ${formatDisplayDate(line.transactionDate)}. When it is uploaded, this Direct Credit is matched to its Stripe payout automatically and the Stripe payments in that payout are confirmed as received in the bank.`,
        method: AWAITING_STRIPE_EXPORT_METHOD,
        registrationId: null,
        payoutId: null,
      }
    }
    return {
      status: "unmatched",
      reason: `No Stripe payout of ${formatCents(line.amountCents)} found in the week before ${formatDisplayDate(line.transactionDate)}, although the uploaded Stripe exports cover this date. Check the amount in Stripe, or choose the payout with Override.`,
      method: "",
      registrationId: null,
      payoutId: null,
    }
  }
  if (candidates.length > 1 && Math.abs(candidates[0].lag) === Math.abs(candidates[1].lag)) {
    return {
      status: "unmatched",
      reason: `More than one Stripe payout of ${formatCents(line.amountCents)} fits this date (${candidates
        .map((c) => c.payout.payoutId)
        .join(", ")}) — choose one with Override.`,
      method: "",
      registrationId: null,
      payoutId: null,
    }
  }

  const { payout } = candidates[0]
  return {
    status: "matched",
    reason: `Stripe payout ${payout.payoutId} (${payout.transactionCount} Stripe row${payout.transactionCount === 1 ? "" : "s"}) paid out on ${formatDisplayDate(melbourneDate(payout.createdUtc))}.`,
    method: "stripe_payout_amount_date",
    registrationId: null,
    payoutId: payout.payoutId,
  }
}

/** Bank transfer → the one registration whose Unique Code / registration number is in the description. */
export const matchBankTransferLine = (
  line: BankLineMatchInput,
  registrations: RegistrationRef[]
): MatchOutcome => {
  const candidates = findRegistrationCandidates(line.description, registrations)

  if (candidates.length === 0) {
    return {
      status: "unmatched",
      reason: "No Unique Code or registration number found in the description.",
      method: "",
      registrationId: null,
    }
  }
  if (candidates.length > 1) {
    return {
      status: "unmatched",
      reason: `The description matches more than one participant (${candidates
        .map((c) => refLabel(c.registration))
        .join(", ")}) — choose one with Override.`,
      method: "",
      registrationId: null,
    }
  }

  const { registration } = candidates[0]
  const registeredOn = melbourneDate(registration.createdAt)
  if (line.transactionDate < registeredOn) {
    return {
      status: "unmatched",
      reason: `Paid on ${formatDisplayDate(line.transactionDate)}, before ${refLabel(registration)} registered on ${formatDisplayDate(registeredOn)} — possibly for an earlier (deleted) registration.`,
      method: "",
      registrationId: registration.id,
    }
  }

  return {
    status: "matched",
    reason: `Unique Code ${refLabel(registration)} found in the description.`,
    method: "bank_description_reference",
    registrationId: registration.id,
  }
}
