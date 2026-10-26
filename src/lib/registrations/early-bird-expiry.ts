import type { PricingConfig } from "@/lib/pricing/calculate"
import {
  confirmedEarlyBirdAdults,
  confirmedEarlyBirdAdultsByPool,
  earlyBirdAdultCount,
  earlyBirdCapForPool,
  earlyBirdPoolForState,
  isEarlyBirdPaymentDuePassed,
  registrationEarlyBirdSlot,
  type EarlyBirdPoolId,
  type EarlyBirdRegistration,
  type EarlyBirdSlot,
} from "@/lib/pricing/early-bird"
import { derivePaymentStatus, type PaymentStatus } from "@/lib/payments/stripe-ledger"
import { toCents } from "@/lib/reconciliation/matching"
import { computeStoredAmountDue, type StoredRegistrationForPricing } from "./service"

export type EarlyBirdExpiryCandidate = EarlyBirdRegistration &
  StoredRegistrationForPricing & {
    id: string
    registration_no: string
    amount_due: number | string
    amount_paid: number | string | null
    payment_status: string
  }

export type EarlyBirdExpiryReason = "payment_due_passed" | "capacity_reached"

export type EarlyBirdExpiryChange = {
  id: string
  registrationNo: string
  pool: EarlyBirdPoolId
  reason: EarlyBirdExpiryReason
  amountPaid: number
  /** Adults moved from the early-bird to the regular rate. */
  adultsMoved: number
  before: { amountDue: number; earlyBirdAdults: number; paymentStatus: string }
  after: {
    amountDue: number
    earlyBirdAdults: number
    paymentStatus: PaymentStatus
    earlyBirdSlot: EarlyBirdSlot
    isEarlyBird: boolean
    /** Value for `early_bird_adult_limit` (`null` when the registration no longer has early bird). */
    earlyBirdAdultLimit: number | null
  }
  feeChanged: boolean
}

/**
 * Early-bird adults that are not covered by payment lose early bird once the payment due date has passed,
 * or once their pool's confirmed (paid) adults reach its cap. Adults covered by payment keep early bird.
 * Without the limit column only registrations with no confirmed adults can be repriced (`canStorePartial`).
 */
export const planEarlyBirdExpiry = (
  registrations: EarlyBirdExpiryCandidate[],
  config: PricingConfig,
  options: { now?: Date; canStorePartial: boolean }
): EarlyBirdExpiryChange[] => {
  const duePassed = isEarlyBirdPaymentDuePassed(config, options.now)
  const confirmedByPool = confirmedEarlyBirdAdultsByPool(registrations, config)
  const poolFull = (pool: EarlyBirdPoolId) => confirmedByPool[pool] >= earlyBirdCapForPool(pool, config)

  return registrations.flatMap((registration) => {
    const slot = registrationEarlyBirdSlot(registration)
    const earlyBirdAdults = earlyBirdAdultCount(registration)
    if (slot === "none" || earlyBirdAdults === 0) return []

    const confirmed = confirmedEarlyBirdAdults(registration, config)
    if (confirmed >= earlyBirdAdults) return []

    const pool = earlyBirdPoolForState(registration.state)
    const reason: EarlyBirdExpiryReason | null = duePassed
      ? "payment_due_passed"
      : poolFull(pool)
        ? "capacity_reached"
        : null
    if (!reason) return []
    if (confirmed > 0 && !options.canStorePartial) return []

    const keepsEarlyBird = confirmed > 0
    const newSlot: EarlyBirdSlot = keepsEarlyBird ? slot : "none"
    const amountPaid = Number(registration.amount_paid ?? 0)
    const oldDue = Number(registration.amount_due ?? 0)
    const newDue = computeStoredAmountDue(registration, newSlot, config, keepsEarlyBird ? confirmed : null)

    return [
      {
        id: registration.id,
        registrationNo: registration.registration_no,
        pool,
        reason,
        amountPaid,
        adultsMoved: earlyBirdAdults - confirmed,
        before: { amountDue: oldDue, earlyBirdAdults, paymentStatus: registration.payment_status },
        after: {
          amountDue: newDue,
          earlyBirdAdults: confirmed,
          paymentStatus: derivePaymentStatus(newDue, amountPaid),
          earlyBirdSlot: newSlot,
          isEarlyBird: keepsEarlyBird,
          earlyBirdAdultLimit: keepsEarlyBird ? confirmed : null,
        },
        feeChanged: toCents(newDue) !== toCents(oldDue),
      },
    ]
  })
}
