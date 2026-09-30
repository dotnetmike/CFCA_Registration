import { createAdminClient } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/log"

export type PaymentStatus = "pending" | "partial" | "paid" | "overpaid"

export const derivePaymentStatus = (amountDue: number, amountPaid: number): PaymentStatus => {
  const due = Number(amountDue) || 0
  const paid = Number(amountPaid) || 0
  if (paid <= 0) return "pending"
  if (paid + 0.001 < due) return "partial"
  if (Math.abs(paid - due) < 0.001) return "paid"
  return "overpaid"
}

export const remainingBalance = (amountDue: number, amountPaid: number) =>
  Math.max(0, Number(amountDue) - Number(amountPaid))

export const applyStripePaymentSuccess = async (params: {
  registrationId: string
  amountAud: number
  paymentIntentId: string
  referenceText?: string
}) => {
  const admin = createAdminClient()
  const amount = Math.round(params.amountAud * 100) / 100

  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("stripe_payment_intent_id", params.paymentIntentId)
    .maybeSingle()

  if (existing) {
    return { alreadyApplied: true as const }
  }

  const { data: registration, error: regError } = await admin
    .from("registrations")
    .select("id, amount_due, amount_paid, participant_reference")
    .eq("id", params.registrationId)
    .single()

  if (regError || !registration) {
    throw new Error(regError?.message ?? "Registration not found")
  }

  const { error: payError } = await admin.from("payments").insert({
    registration_id: params.registrationId,
    amount,
    reference_text:
      params.referenceText ??
      `Stripe ${params.paymentIntentId}`,
    source: "stripe",
    stripe_payment_intent_id: params.paymentIntentId,
  })

  if (payError) {
    if (payError.message?.includes("idx_payments_stripe_payment_intent_id")) {
      return { alreadyApplied: true as const }
    }
    throw new Error(payError.message)
  }

  const nextPaid = Number(registration.amount_paid) + amount
  const status = derivePaymentStatus(Number(registration.amount_due), nextPaid)

  const { error: updateError } = await admin
    .from("registrations")
    .update({
      amount_paid: nextPaid,
      payment_status: status,
      payment_last_updated_source: "stripe",
      payment_last_updated_at: new Date().toISOString(),
      payment_last_updated_by: null,
    })
    .eq("id", params.registrationId)

  if (updateError) throw new Error(updateError.message)

  await writeAuditLog({
    action: "payment.stripe_succeeded",
    updatedValue: {
      amount_paid: nextPaid,
      payment_status: status,
    },
    metadata: {
      registration_id: params.registrationId,
      amount,
      paymentIntentId: params.paymentIntentId,
    },
  })

  return {
    alreadyApplied: false as const,
    amountPaid: nextPaid,
    paymentStatus: status,
    participantReference: registration.participant_reference as string | null,
  }
}
