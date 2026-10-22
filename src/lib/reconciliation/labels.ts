import type {
  BankLineKind,
  BankSettlement,
  ReconciliationItemType,
  ReconciliationRunSource,
  ReconciliationStatus,
} from "@/lib/reconciliation/types"

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  matched: "Matched",
  unmatched: "Unmatched",
  ignored: "Ignored",
  not_applicable: "Not applicable",
}

export const RECONCILIATION_STATUS_HELP: Record<ReconciliationStatus, string> = {
  matched:
    "Linked to a participant and accounted for. Stripe: the payment is recorded on the registration. Bank: the transfer was applied to the registration's Amount paid, or the Stripe payout was found.",
  unmatched:
    "Needs your review. Read the reason, then use Override to choose the right participant, or Ignore with a comment.",
  ignored:
    "Reviewed and excluded by an admin (comment required). Skipped on future uploads and re-checks.",
  not_applicable:
    "Not a participant payment — Stripe fees, Stripe payouts or money out of the bank account. No action needed.",
}

export const BANK_LINE_KIND_LABELS: Record<BankLineKind, string> = {
  transfer: "Bank transfer",
  stripe_payout: "Stripe payout",
  debit: "Money out",
}

export const BANK_SETTLEMENT_LABELS: Record<BankSettlement, string> = {
  received: "Received in bank",
  awaiting_bank: "Paid out, awaiting bank statement",
  not_paid_out: "Not paid out yet",
}

export const AWAITING_STRIPE_EXPORT_LABEL = "Awaiting Stripe export"

export const RUN_SOURCE_LABELS: Record<ReconciliationRunSource, string> = {
  stripe: "Stripe upload",
  bank: "Bank statement upload",
  recheck: "Re-check unmatched",
}

export const ITEM_TYPE_LABELS: Record<ReconciliationItemType, string> = {
  stripe: "Stripe",
  bank: "Bank",
}

export const RECONCILIATION_ACTION_LABELS: Record<string, string> = {
  imported: "Imported",
  rechecked: "Re-checked",
  status_override: "Status overridden",
  ignored: "Ignored",
  payment_applied: "Payment applied",
  payment_reversed: "Payment reversed",
  payment_apply_failed: "Payment could not be applied",
  bank_confirmed: "Received in bank",
  bank_unconfirmed: "Bank confirmation removed",
  run_completed: "Run completed",
  run_failed: "Run failed",
}

export const formatReconciliationAction = (action: string) =>
  RECONCILIATION_ACTION_LABELS[action] ?? action

export const RECONCILIATION_HELP = {
  page:
    "Upload exports from Stripe and the CBA account in any order. Each row is matched to a registered participant. Rows already Matched, Ignored or overridden by an admin are skipped when you upload again, so overlapping files are safe.",
  bankSettlement:
    "Received in bank: the Stripe payout containing this row was found in the CBA statement as a Direct Credit from STRIPE. Uploads can come in any order — a bank statement uploaded first keeps its STRIPE credits waiting, and they are confirmed as soon as the matching Stripe export is uploaded.",
  awaitingStripeExport:
    "This Direct Credit from STRIPE arrived before the Stripe export covering its date was uploaded. It is matched to its payout automatically when that export is uploaded — no action needed.",
  stripeUpload:
    "Stripe Dashboard → Balance → Balance history (All activity) → Export → CSV. Include the metadata columns registration_id and participant_reference. Payments are matched to the registration saved on the Stripe payment and checked against the payment recorded in this system.",
  bankUpload:
    "CommBank NetBank → the CFCA account → Export → CSV. Transfers are matched by the Unique Code (e.g. VIC_SMITH_001) or registration number in the description, and the payment is applied to that registration automatically (Amount paid updated, Payment received email sent). Direct Credits from STRIPE are matched to Stripe payouts. You can upload this before the Stripe export: STRIPE credits wait and are matched when the Stripe export arrives.",
  payouts:
    "Stripe pays out the balance in batches. A payout contains the Stripe rows whose “Available On” time is after the previous payout and up to this payout. It appears in CBA as “Direct Credit … STRIPE”. Difference ≠ $0.00 means some rows for that payout are not in the uploaded Stripe exports yet. When the Direct Credit is matched, every Stripe row in the payout is marked Received in bank, whichever export was uploaded first.",
  recheck:
    "Re-runs matching for Unmatched rows only (not Matched, Ignored or overridden rows) — useful after new registrations or a new Stripe export.",
  override:
    "Override sets the status yourself. A comment is required and the change is logged. On bank transfers, choosing Matched applies the payment to the chosen registration; moving away from Matched reverses it.",
  ignore:
    "Ignore excludes this row from reconciliation (e.g. a test payment). A comment is required and the change is logged.",
} as const
