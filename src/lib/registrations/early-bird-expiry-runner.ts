import { createAdminClient } from "@/lib/supabase/admin"
import type { PricingConfig } from "@/lib/pricing/calculate"
import { writeAuditLog } from "@/lib/audit/log"
import { sendRegistrationEmail } from "@/lib/email/send"
import type { EmailPacer } from "@/lib/payments/payment-reminders"
import { hasEarlyBirdAdultLimitColumn } from "./early-bird-column"
import {
  planEarlyBirdExpiry,
  type EarlyBirdExpiryCandidate,
  type EarlyBirdExpiryChange,
} from "./early-bird-expiry"
import { getRegistrationWithAttendees } from "./service"

export const EARLY_BIRD_EXPIRED_ACTION = "registration.early_bird_expired"

const CANDIDATE_SELECT =
  "id, registration_no, state, is_early_bird, early_bird_slot, spouse_attending, souvenir_orders, amount_due, amount_paid, payment_status, registration_attendees(age)"

export type EarlyBirdExpiryResult = {
  planned: number
  repriced: number
  emailed: number
  skipped: string[]
  /** Not started because the run was out of time; picked up by the next run. */
  deferred: string[]
}

const applyChange = async (change: EarlyBirdExpiryChange, hasLimitColumn: boolean) => {
  const { data, error } = await createAdminClient()
    .from("registrations")
    .update({
      amount_due: change.after.amountDue,
      payment_status: change.after.paymentStatus,
      is_early_bird: change.after.isEarlyBird,
      early_bird_slot: change.after.earlyBirdSlot,
      ...(hasLimitColumn ? { early_bird_adult_limit: change.after.earlyBirdAdultLimit } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", change.id)
    .eq("amount_due", change.before.amountDue)
    .eq("amount_paid", change.amountPaid)
    .select("id")
  if (error) throw new Error(`${change.registrationNo}: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * Moves unpaid early-bird adults to the regular rate after the payment due date or once a pool is full
 * (see `planEarlyBirdExpiry`), audits each change and emails the registrant when the fee changed.
 * A registration whose fee or payments changed since it was read is skipped and re-checked on the next run.
 * With a pacer, emails are spaced out and no new change starts once the run is out of time, so a fee
 * change is never left without its email.
 */
export const runEarlyBirdExpiry = async (
  pricing: PricingConfig,
  request: Request,
  pacer?: EmailPacer
): Promise<EarlyBirdExpiryResult> => {
  const hasLimitColumn = await hasEarlyBirdAdultLimitColumn()
  const { data, error } = await createAdminClient()
    .from("registrations")
    .select(hasLimitColumn ? `${CANDIDATE_SELECT}, early_bird_adult_limit` : CANDIDATE_SELECT)
    .eq("is_early_bird", true)
    .not("submitted_at", "is", null)
    .limit(10000)
  if (error) throw new Error(error.message)

  const changes = planEarlyBirdExpiry((data ?? []) as unknown as EarlyBirdExpiryCandidate[], pricing, {
    canStorePartial: hasLimitColumn,
  })
  const result: EarlyBirdExpiryResult = {
    planned: changes.length,
    repriced: 0,
    emailed: 0,
    skipped: [],
    deferred: [],
  }

  for (const change of changes) {
    if (pacer && !pacer.hasTimeForAnother()) {
      result.deferred.push(change.registrationNo)
      continue
    }
    try {
      if (!(await applyChange(change, hasLimitColumn))) {
        result.skipped.push(change.registrationNo)
        continue
      }
      result.repriced += 1
      await writeAuditLog({
        userId: null,
        action: EARLY_BIRD_EXPIRED_ACTION,
        previousValue: {
          amount_due: change.before.amountDue,
          payment_status: change.before.paymentStatus,
          early_bird_adults: change.before.earlyBirdAdults,
        },
        updatedValue: {
          amount_due: change.after.amountDue,
          payment_status: change.after.paymentStatus,
          early_bird_adults: change.after.earlyBirdAdults,
        },
        metadata: {
          registration_id: change.id,
          registration_no: change.registrationNo,
          reason: change.reason,
          adults_moved_to_regular: change.adultsMoved,
        },
      })

      if (!change.feeChanged) continue
      const full = await getRegistrationWithAttendees(change.id)
      if (!full) continue
      await pacer?.waitForTurn()
      await sendRegistrationEmail(full, "early_bird_pricing_updated", {
        request,
        earlyBirdChange: {
          reason: change.reason,
          previousAmountDue: change.before.amountDue,
          adultsMoved: change.adultsMoved,
          adultsKeptEarlyBird: change.after.earlyBirdAdults,
        },
      })
      result.emailed += 1
    } catch (err) {
      console.error("[early-bird] Expiry failed for", change.registrationNo, err)
      result.skipped.push(change.registrationNo)
    }
  }

  return result
}
