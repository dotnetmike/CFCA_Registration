import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe/client"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"
import { jsonError } from "@/lib/auth/api"
import { applyStripeCheckoutSessionPaid } from "@/lib/payments/stripe-checkout-session"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { sendRegistrationEmail } from "@/lib/email/send"

const querySchema = z.object({
  session_id: z.string().startsWith("cs_"),
})

export type CheckoutOutcome = "succeeded" | "processing" | "failed" | "expired" | "open"

const FAILED_INTENT_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "canceled",
])

const outcomeForUnpaidSession = (session: Stripe.Checkout.Session): CheckoutOutcome => {
  if (session.status === "expired") return "expired"
  if (session.status === "open") return "open"
  const intent =
    session.payment_intent && typeof session.payment_intent === "object"
      ? session.payment_intent
      : null
  if (intent && FAILED_INTENT_STATUSES.has(intent.status)) return "failed"
  return "processing"
}

/** Recovery after Checkout redirect — confirms session and applies ledger if webhook lagged. */
export const GET = async (request: NextRequest) => {
  if (!isStripePaymentsEnabled()) return jsonError("Online payment is not configured", 503)
  const stripe = getStripe()
  if (!stripe) return jsonError("Online payment is not configured", 503)

  const parsed = querySchema.safeParse({
    session_id: request.nextUrl.searchParams.get("session_id"),
  })
  if (!parsed.success) return jsonError("Missing session_id")

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(parsed.data.session_id, {
      expand: ["payment_intent"],
    })
  } catch {
    return jsonError("Payment session not found", 404)
  }

  const result = await applyStripeCheckoutSessionPaid(session)

  if (result.skipped) {
    const outcome = outcomeForUnpaidSession(session)
    return NextResponse.json({ outcome, status: outcome })
  }

  if (!result.alreadyApplied) {
    const full = await getRegistrationWithAttendees(result.registrationId)
    if (full) await sendRegistrationEmail(full, "payment_received", { request })
  }

  return NextResponse.json({
    outcome: "succeeded" satisfies CheckoutOutcome,
    status: "succeeded",
    paymentStatus: result.paymentStatus ?? "paid",
    alreadyApplied: result.alreadyApplied,
  })
}
