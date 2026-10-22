import { classifyStripeType, toCents } from "./matching"
import type { ReconciledAmount } from "./types"

export type ReconciledBankPayment = { registrationId: string; amount: number | string }

export type ReconciledStripeRow = {
  registrationId: string | null
  type: string
  net: number | string
  fee: number | string
  status: string
  bankLineId: string | null
}

/**
 * Per registration, the money confirmed in the CBA account: applied bank transfers (reversals are negative)
 * plus the net of matched Stripe payments / refunds whose payout was received in the bank.
 */
export const summarizeReconciledAmounts = (
  bankPayments: ReconciledBankPayment[],
  stripeRows: ReconciledStripeRow[]
): Record<string, ReconciledAmount> => {
  const cents = new Map<string, { bank: number; stripeNet: number; stripeFees: number }>()
  const entry = (registrationId: string) => {
    const existing = cents.get(registrationId)
    if (existing) return existing
    const created = { bank: 0, stripeNet: 0, stripeFees: 0 }
    cents.set(registrationId, created)
    return created
  }

  for (const payment of bankPayments) {
    entry(payment.registrationId).bank += toCents(payment.amount)
  }

  for (const row of stripeRows) {
    if (!row.registrationId || !row.bankLineId || row.status !== "matched") continue
    const kind = classifyStripeType(row.type)
    if (kind !== "payment" && kind !== "refund") continue
    const target = entry(row.registrationId)
    target.stripeNet += toCents(row.net)
    target.stripeFees += toCents(row.fee)
  }

  return Object.fromEntries(
    [...cents].map(([registrationId, c]) => [
      registrationId,
      { bank: c.bank / 100, stripeNet: c.stripeNet / 100, stripeFees: c.stripeFees / 100 },
    ])
  )
}
