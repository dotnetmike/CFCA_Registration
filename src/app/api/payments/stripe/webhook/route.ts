import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe/client"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"
import { applyStripeCheckoutSessionPaid } from "@/lib/payments/stripe-checkout-session"
import { applyStripePaymentSuccess } from "@/lib/payments/stripe-ledger"
import { writeAuditLog } from "@/lib/audit/log"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { sendRegistrationEmail } from "@/lib/email/send"

export const runtime = "nodejs"

const sendPaymentReceivedIfNeeded = async (
  registrationId: string,
  alreadyApplied: boolean,
  request: NextRequest
) => {
  if (alreadyApplied) return
  const full = await getRegistrationWithAttendees(registrationId)
  if (full) {
    await sendRegistrationEmail(full, "payment_received", { request })
  }
}

const auditCheckoutSession = async (action: string, session: Stripe.Checkout.Session) => {
  await writeAuditLog({
    action,
    metadata: {
      registration_id: session.metadata?.registration_id ?? null,
      checkout_session_id: session.id,
      session_status: session.status,
      payment_status: session.payment_status,
    },
  })
}

const handleCheckoutSessionPaid = async (
  session: Stripe.Checkout.Session,
  request: NextRequest
) => {
  const result = await applyStripeCheckoutSessionPaid(session)
  if (result.skipped) {
    // Delayed payment methods complete Checkout before funds settle
    await auditCheckoutSession(
      result.reason === "unpaid"
        ? "payment.stripe_checkout_processing"
        : "payment.stripe_checkout_completed",
      session
    )
    return
  }
  await sendPaymentReceivedIfNeeded(result.registrationId, result.alreadyApplied, request)
}

/**
 * Stripe webhook endpoint. The request body is treated as untrusted: only the
 * event id is read, then the event is re-fetched from Stripe using STRIPE_SECRET_KEY.
 */
export const POST = async (request: NextRequest) => {
  if (!isStripePaymentsEnabled()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 })
  }

  const payload = (await request.json().catch(() => null)) as { id?: unknown } | null
  const eventId = typeof payload?.id === "string" ? payload.id : ""
  if (!eventId.startsWith("evt_")) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.events.retrieve(eventId)
  } catch (err) {
    console.error("[stripe.webhook] event lookup failed", err)
    return NextResponse.json({ error: "Unknown event" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutSessionPaid(event.data.object, request)
        break

      case "checkout.session.async_payment_failed":
        await auditCheckoutSession("payment.stripe_checkout_failed", event.data.object)
        break

      case "checkout.session.expired":
        await auditCheckoutSession("payment.stripe_checkout_expired", event.data.object)
        break

      case "payment_intent.succeeded": {
        const intent = event.data.object
        const registrationId = intent.metadata?.registration_id
        if (!registrationId) break
        const result = await applyStripePaymentSuccess({
          registrationId,
          amountAud: (intent.amount_received ?? intent.amount) / 100,
          paymentIntentId: intent.id,
        })
        await sendPaymentReceivedIfNeeded(registrationId, result.alreadyApplied, request)
        break
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object
        await writeAuditLog({
          action: "payment.stripe_failed",
          metadata: {
            registration_id: intent.metadata?.registration_id ?? null,
            payment_intent_id: intent.id,
            error: intent.last_payment_error?.message ?? null,
          },
        })
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error("[stripe.webhook] handler error", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
