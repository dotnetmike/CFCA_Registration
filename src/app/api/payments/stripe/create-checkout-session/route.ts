import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { z } from "zod"
import { requireAuth, jsonError } from "@/lib/auth/api"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe/client"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"
import { remainingBalance } from "@/lib/payments/stripe-ledger"
import {
  getRegistrationBySignupToken,
  getRegistrationByViewToken,
} from "@/lib/registrations/view-token"
import { writeAuditLog } from "@/lib/audit/log"
import { getRequestSiteUrl } from "@/lib/site-url"

// Stripe minimum is 30 minutes
const CHECKOUT_SESSION_TTL_SECONDS = 30 * 60

const bodySchema = z.object({
  attemptId: z.string().uuid(),
  signupToken: z.string().min(1).optional(),
  viewToken: z.string().min(1).optional(),
  registrationId: z.string().uuid().optional(),
  successPath: z
    .string()
    .refine(
      (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("://"),
      "Invalid success path"
    )
    .optional(),
  cancelPath: z
    .string()
    .refine(
      (value) => value.startsWith("/") && !value.startsWith("//") && !value.includes("://"),
      "Invalid cancel path"
    )
    .optional(),
})

type RegistrationPayRow = {
  id: string
  amount_due: number
  amount_paid: number
  email: string | null
  participant_reference: string | null
  user_id: string | null
  submitted_at: string | null
}

export const POST = async (request: NextRequest) => {
  if (!isStripePaymentsEnabled()) {
    return jsonError("Online payment is not configured", 503)
  }

  const stripe = getStripe()
  if (!stripe) return jsonError("Online payment is not configured", 503)

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid request")

  let registration: RegistrationPayRow | null = null

  if (parsed.data.signupToken) {
    registration = await getRegistrationBySignupToken(parsed.data.signupToken)
  } else if (parsed.data.viewToken) {
    registration = await getRegistrationByViewToken(parsed.data.viewToken)
  } else {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const admin = createAdminClient()
    if (parsed.data.registrationId) {
      const { data } = await admin
        .from("registrations")
        .select(
          "id, amount_due, amount_paid, email, participant_reference, user_id, submitted_at"
        )
        .eq("id", parsed.data.registrationId)
        .maybeSingle()
      if (
        data &&
        (data.user_id === auth.sub ||
          auth.permissions.includes("registrations:write_all"))
      ) {
        registration = data
      }
    } else {
      const { data } = await admin
        .from("registrations")
        .select(
          "id, amount_due, amount_paid, email, participant_reference, user_id, submitted_at"
        )
        .eq("user_id", auth.sub)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      registration = data
    }
  }

  if (!registration || !registration.submitted_at) {
    return jsonError("Registration not found", 404)
  }

  const remaining = remainingBalance(
    Number(registration.amount_due),
    Number(registration.amount_paid)
  )
  if (remaining <= 0) {
    return jsonError("No remaining balance to pay", 400)
  }

  const amountCents = Math.round(remaining * 100)
  if (amountCents < 50) {
    return jsonError("Amount too small for card payment", 400)
  }

  const origin = getRequestSiteUrl(request)
  const successPath = parsed.data.successPath || "/register/complete"
  const cancelPath =
    parsed.data.cancelPath ||
    (parsed.data.signupToken || parsed.data.viewToken ? "/register/pay" : "/payment")

  const successUrl = new URL(successPath, origin)
  if (parsed.data.signupToken) successUrl.searchParams.set("token", parsed.data.signupToken)
  if (parsed.data.viewToken) successUrl.searchParams.set("view", parsed.data.viewToken)
  successUrl.searchParams.set("payment", "success")
  // Append unencoded Stripe placeholder (URLSearchParams would encode braces)
  const successUrlString = `${successUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`

  const cancelUrl = new URL(cancelPath, origin)
  if (parsed.data.signupToken) cancelUrl.searchParams.set("token", parsed.data.signupToken)
  if (parsed.data.viewToken) cancelUrl.searchParams.set("view", parsed.data.viewToken)
  cancelUrl.searchParams.set("payment", "cancelled")

  const uniqueCode = registration.participant_reference ?? registration.id
  const metadata = {
    registration_id: registration.id,
    participant_reference: registration.participant_reference ?? "",
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: registration.email || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "aud",
              unit_amount: amountCents,
              product_data: {
                name: "CFCA Conference registration",
                description: `Unique Code ${uniqueCode}`,
              },
            },
          },
        ],
        success_url: successUrlString,
        cancel_url: cancelUrl.toString(),
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS,
        metadata,
        payment_intent_data: {
          metadata,
          description: `CFCA Conference ${uniqueCode}`,
        },
      },
      {
        idempotencyKey: `checkout-reg-${registration.id}-${parsed.data.attemptId}`,
      }
    )
  } catch (err) {
    const stripeError = err instanceof Stripe.errors.StripeError ? err : null
    console.error("[stripe] checkout.sessions.create failed", {
      registrationId: registration.id,
      type: stripeError?.type,
      code: stripeError?.code,
      statusCode: stripeError?.statusCode,
      requestId: stripeError?.requestId,
      message: err instanceof Error ? err.message : String(err),
    })
    await writeAuditLog({
      action: "payment.stripe_checkout_start_failed",
      metadata: {
        registration_id: registration.id,
        stripe_error_type: stripeError?.type ?? null,
        stripe_error_code: stripeError?.code ?? null,
        stripe_request_id: stripeError?.requestId ?? null,
        message: err instanceof Error ? err.message : String(err),
      },
      request,
    })
    const reference = stripeError?.code ?? stripeError?.type
    return jsonError(
      `Online payment is unavailable right now${reference ? ` (${reference})` : ""}. Please try again later or choose Bank Payment.`,
      502
    )
  }

  if (!session.url) {
    return jsonError("Could not start Stripe Checkout", 500)
  }

  await writeAuditLog({
    action: "payment.stripe_checkout_session_created",
    metadata: {
      registration_id: registration.id,
      checkout_session_id: session.id,
      amount_cents: amountCents,
    },
    request,
  })

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
    amount: remaining,
  })
}
