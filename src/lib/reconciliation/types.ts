export const RECONCILIATION_STATUSES = ["matched", "unmatched", "ignored", "not_applicable"] as const
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number]

export type ReconciliationItemType = "stripe" | "bank"
export type BankLineKind = "transfer" | "stripe_payout" | "debit"
export type ReconciliationRunSource = "stripe" | "bank" | "recheck"
export const BANK_SETTLEMENTS = ["received", "awaiting_bank", "not_paid_out"] as const
export type BankSettlement = (typeof BANK_SETTLEMENTS)[number]

export type RegistrationOption = {
  id: string
  registrationNo: string
  participantReference: string
  name: string
  amountDue: number
  amountPaid: number
  paymentStatus: string
}

export type StripeTransactionView = {
  id: string
  stripeTxnId: string
  type: string
  sourceId: string
  amount: number
  fee: number
  net: number
  currency: string
  createdUtc: string
  availableOnUtc: string
  metadataRegistrationId: string
  metadataParticipantReference: string
  status: ReconciliationStatus
  statusReason: string
  matchMethod: string
  matchedRegistrationId: string | null
  paymentId: string | null
  manualOverride: boolean
  statusComment: string
  statusUpdatedByName: string | null
  statusUpdatedAt: string | null
  payoutId: string | null
  payoutCreatedUtc: string | null
  settledBankDate: string | null
  bankLineId: string | null
  bankSettlement: BankSettlement
}

export type BankLineView = {
  id: string
  transactionDate: string
  amount: number
  description: string
  balance: number | null
  kind: BankLineKind
  status: ReconciliationStatus
  statusReason: string
  matchMethod: string
  matchedRegistrationId: string | null
  matchedStripePayoutId: string | null
  awaitingStripeExport: boolean
  appliedAmount: number
  manualOverride: boolean
  statusComment: string
  statusUpdatedByName: string | null
  statusUpdatedAt: string | null
}

export type StripePayoutView = {
  payoutId: string
  stripeTxnId: string
  createdUtc: string
  amount: number
  transactionCount: number
  coveredNet: number
  difference: number
  bankLineId: string | null
  bankDate: string | null
}

export type ReconciliationRunView = {
  id: string
  source: ReconciliationRunSource
  filename: string | null
  status: "processing" | "completed" | "failed"
  rowsInFile: number
  newRows: number
  skippedRows: number
  recheckedRows: number
  matched: number
  unmatched: number
  notApplicable: number
  paymentsApplied: number
  amountApplied: number
  bankConfirmed: number
  error: string | null
  createdByName: string | null
  createdAt: string
}

export type ReconciliationEventView = {
  id: string
  runId: string | null
  itemType: ReconciliationItemType | null
  itemId: string | null
  itemLabel: string
  action: string
  fromStatus: string | null
  toStatus: string | null
  registrationId: string | null
  amount: number | null
  comment: string
  actorName: string | null
  createdAt: string
}

/** Money confirmed received in the CBA account for one registration. */
export type ReconciledAmount = {
  /** Bank transfers applied from the CBA statement (net of reversals). */
  bank: number
  /** Stripe payments minus refunds received in the bank, after Stripe fees. */
  stripeNet: number
  stripeFees: number
}

export type ReconciledAmountsResponse = {
  amounts: Record<string, ReconciledAmount>
}

export type ReconciliationOverview = {
  runs: ReconciliationRunView[]
  stripe: StripeTransactionView[]
  bank: BankLineView[]
  payouts: StripePayoutView[]
  events: ReconciliationEventView[]
  registrations: RegistrationOption[]
}

export type ReconciliationOverrideRequest = {
  itemType: ReconciliationItemType
  itemId: string
  status: ReconciliationStatus
  registrationId?: string | null
  payoutId?: string | null
  comment: string
}
