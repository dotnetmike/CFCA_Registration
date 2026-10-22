import type { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/log"
import { derivePaymentStatus, type PaymentStatus } from "@/lib/payments/stripe-ledger"

const roundCents = (value: number) => Math.round(value * 100) / 100

type RegistrationPaymentRow = {
  id: string
  amount_due: number | string
  amount_paid: number | string
  payment_status: string
}

const loadRegistrationPayment = async (registrationId: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("registrations")
    .select("id, amount_due, amount_paid, payment_status")
    .eq("id", registrationId)
    .maybeSingle()
  if (error || !data) throw new Error(error?.message ?? "Registration not found")
  return data as RegistrationPaymentRow
}

const setRegistrationPaid = async (
  registration: RegistrationPaymentRow,
  amountPaid: number,
  actorId: string
): Promise<PaymentStatus> => {
  const admin = createAdminClient()
  const status = derivePaymentStatus(Number(registration.amount_due), amountPaid)
  const now = new Date().toISOString()
  const { error } = await admin
    .from("registrations")
    .update({
      amount_paid: amountPaid,
      payment_status: status,
      payment_last_updated_source: "bank_reconcile",
      payment_last_updated_at: now,
      payment_last_updated_by: actorId,
      updated_at: now,
    })
    .eq("id", registration.id)
  if (error) throw new Error(error.message)
  return status
}

export type AppliedBankPayment = {
  paymentId: string
  registrationId: string
  amount: number
  amountPaid: number
  paymentStatus: PaymentStatus
}

/** Records a bank transfer from a reconciled statement line against a registration. */
export const applyBankLinePayment = async (params: {
  lineId: string
  registrationId: string
  amount: number
  description: string
  actorId: string
  request?: NextRequest
}): Promise<AppliedBankPayment> => {
  const admin = createAdminClient()
  const amount = roundCents(params.amount)
  const registration = await loadRegistrationPayment(params.registrationId)

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      registration_id: params.registrationId,
      amount,
      reference_text: `Bank: ${params.description}`.slice(0, 500),
      source: "bank_reconcile",
      reconciliation_bank_line_id: params.lineId,
      created_by: params.actorId,
    })
    .select("id")
    .single()
  if (paymentError || !payment) throw new Error(paymentError?.message ?? "Could not record payment")

  const amountPaid = roundCents(Number(registration.amount_paid) + amount)
  let paymentStatus: PaymentStatus
  try {
    paymentStatus = await setRegistrationPaid(registration, amountPaid, params.actorId)
  } catch (err) {
    await admin.from("payments").delete().eq("id", payment.id)
    throw err
  }

  await writeAuditLog({
    userId: params.actorId,
    action: "payment.record",
    previousValue: {
      amount_paid: registration.amount_paid,
      payment_status: registration.payment_status,
    },
    updatedValue: { amount_paid: amountPaid, payment_status: paymentStatus },
    metadata: {
      registration_id: params.registrationId,
      amount,
      source: "bank_reconcile",
      bank_line_id: params.lineId,
    },
    request: params.request,
  })

  return { paymentId: payment.id, registrationId: params.registrationId, amount, amountPaid, paymentStatus }
}

/** Net amount still applied from a bank line, per registration (reversals are negative rows). */
export const getAppliedAmountsForLine = async (lineId: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("payments")
    .select("registration_id, amount")
    .eq("reconciliation_bank_line_id", lineId)
  if (error) throw new Error(error.message)
  const net = new Map<string, number>()
  for (const row of data ?? []) {
    net.set(row.registration_id, roundCents((net.get(row.registration_id) ?? 0) + Number(row.amount)))
  }
  return new Map([...net].filter(([, amount]) => amount > 0))
}

/** Reverses everything a bank line applied, with negative ledger rows (the ledger stays append-only). */
export const reverseBankLinePayments = async (params: {
  lineId: string
  description: string
  actorId: string
  request?: NextRequest
}) => {
  const admin = createAdminClient()
  const applied = await getAppliedAmountsForLine(params.lineId)
  const reversed: { registrationId: string; amount: number; paymentStatus: PaymentStatus }[] = []

  for (const [registrationId, amount] of applied) {
    const registration = await loadRegistrationPayment(registrationId)
    const { error } = await admin.from("payments").insert({
      registration_id: registrationId,
      amount: -amount,
      reference_text: `Reversed bank reconciliation: ${params.description}`.slice(0, 500),
      source: "bank_reconcile",
      reconciliation_bank_line_id: params.lineId,
      created_by: params.actorId,
    })
    if (error) throw new Error(error.message)

    const amountPaid = Math.max(0, roundCents(Number(registration.amount_paid) - amount))
    const paymentStatus = await setRegistrationPaid(registration, amountPaid, params.actorId)

    await writeAuditLog({
      userId: params.actorId,
      action: "payment.reconcile_reversed",
      previousValue: {
        amount_paid: registration.amount_paid,
        payment_status: registration.payment_status,
      },
      updatedValue: { amount_paid: amountPaid, payment_status: paymentStatus },
      metadata: { registration_id: registrationId, amount: -amount, bank_line_id: params.lineId },
      request: params.request,
    })
    reversed.push({ registrationId, amount, paymentStatus })
  }

  return reversed
}
