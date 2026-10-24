import type { PricingConfig } from "@/lib/pricing/calculate"
import { derivePaymentStatus, remainingBalance, type PaymentStatus } from "@/lib/payments/stripe-ledger"
import { toCents } from "@/lib/reconciliation/matching"
import { computeStoredAmountDue, type StoredRegistrationForPricing } from "./service"

type EarlyBirdSlot = "interstate" | "melbourne" | "none"

export type RepriceCandidate = StoredRegistrationForPricing & {
  id: string
  registration_no: string
  given_name: string
  surname: string
  is_early_bird: boolean | null
  early_bird_slot: string | null
  amount_due: number | string
  amount_paid: number | string | null
  payment_status: string
}

export type RepriceSnapshot = {
  amountDue: number
  balance: number
  paymentStatus: string
}

export type RepriceChange = {
  id: string
  registrationNo: string
  name: string
  attendeeAges: number[]
  earlyBirdSlot: EarlyBirdSlot
  amountPaid: number
  before: RepriceSnapshot
  after: RepriceSnapshot & { paymentStatus: PaymentStatus }
}

const resolveSlot = (row: RepriceCandidate): EarlyBirdSlot =>
  row.is_early_bird ? ((row.early_bird_slot as EarlyBirdSlot) ?? "none") : "none"

/** Registrations whose stored amount due differs from the current pricing rules, with before / after values. */
export const planRegistrationRepricing = (
  rows: RepriceCandidate[],
  pricingConfig: PricingConfig
): RepriceChange[] =>
  rows.flatMap((row) => {
    const earlyBirdSlot = resolveSlot(row)
    const amountPaid = Number(row.amount_paid ?? 0)
    const oldDue = Number(row.amount_due ?? 0)
    const newDue = computeStoredAmountDue(row, earlyBirdSlot, pricingConfig)
    if (toCents(newDue) === toCents(oldDue)) return []
    return [
      {
        id: row.id,
        registrationNo: row.registration_no,
        name: `${row.given_name} ${row.surname}`.trim(),
        attendeeAges: (row.registration_attendees ?? row.attendees ?? []).map((a) => a.age),
        earlyBirdSlot,
        amountPaid,
        before: {
          amountDue: oldDue,
          balance: remainingBalance(oldDue, amountPaid),
          paymentStatus: row.payment_status,
        },
        after: {
          amountDue: newDue,
          balance: remainingBalance(newDue, amountPaid),
          paymentStatus: derivePaymentStatus(newDue, amountPaid),
        },
      },
    ]
  })
