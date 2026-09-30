import type Stripe from "stripe"
import { applyStripePaymentSuccess } from "@/lib/payments/stripe-ledger"

export const paymentIntentIdFromCheckoutSession = (
  session: Stripe.Checkout.Session
): string | null => {
  if (typeof session.payment_intent === "string") return session.payment_intent
  if (session.payment_intent && typeof session.payment_intent === "object") {
    return session.payment_intent.id
  }
  return null
}

type SkippedResult = { skipped: true; reason: string }

type AppliedResult = {
  skipped: false
  registrationId: string
  paymentIntentId: string
  sessionId: string
  alreadyApplied: boolean
  paymentStatus?: string
}

/** Apply ledger from a paid Checkout Session (webhook or status recovery). */
export const applyStripeCheckoutSessionPaid = async (
  session: Stripe.Checkout.Session
): Promise<SkippedResult | AppliedResult> => {
  if (session.payment_status !== "paid") {
    return { skipped: true, reason: session.payment_status }
  }

  const registrationId = session.metadata?.registration_id
  const paymentIntentId = paymentIntentIdFromCheckoutSession(session)
  if (!registrationId || !paymentIntentId) {
    return { skipped: true, reason: "missing_metadata" }
  }

  const amountAud = (session.amount_total ?? 0) / 100
  const result = await applyStripePaymentSuccess({
    registrationId,
    amountAud,
    paymentIntentId,
    referenceText: `Stripe Checkout ${session.id}`,
  })

  return {
    skipped: false,
    registrationId,
    paymentIntentId,
    sessionId: session.id,
    alreadyApplied: result.alreadyApplied,
    paymentStatus: result.alreadyApplied ? undefined : result.paymentStatus,
  }
}
