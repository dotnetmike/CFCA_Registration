import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, jsonError } from "@/lib/auth/api"
import { writeAuditLog } from "@/lib/audit/log"
import { sendRegistrationEmail } from "@/lib/email/send"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"

type RouteParams = { params: Promise<{ id: string }> }

const paymentUpdateSchema = z.object({
  amount_paid: z.coerce.number().min(0),
  payment_status: z.enum(["pending", "partial", "paid", "overpaid"]),
})

const canManagePayments = (permissions: string[]) =>
  permissions.includes("payments:reconcile") || permissions.includes("registrations:write_all")

export const PATCH = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  if (!canManagePayments(auth.permissions)) return jsonError("Forbidden", 403)

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = paymentUpdateSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid payment data")

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!existing) return jsonError("Not found", 404)

  const amountPaid = Number(parsed.data.amount_paid)
  const paymentStatus = parsed.data.payment_status
  const previousPaid = Number(existing.amount_paid)

  if (
    previousPaid === amountPaid &&
    existing.payment_status === paymentStatus
  ) {
    const registration = await getRegistrationWithAttendees(id)
    return NextResponse.json({ registration, unchanged: true })
  }

  const delta = amountPaid - previousPaid
  const now = new Date().toISOString()

  if (delta > 0) {
    await admin.from("payments").insert({
      registration_id: id,
      amount: delta,
      reference_text: existing.participant_reference || existing.registration_no,
      source: "manual",
      created_by: auth.sub,
    })
  }

  const { error } = await admin
    .from("registrations")
    .update({
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      payment_last_updated_source: "manual",
      payment_last_updated_at: now,
      payment_last_updated_by: auth.sub,
      updated_at: now,
    })
    .eq("id", id)

  if (error) return jsonError(error.message, 500)

  await writeAuditLog({
    userId: auth.sub,
    action: "payment.manual_update",
    previousValue: {
      amount_paid: existing.amount_paid,
      payment_status: existing.payment_status,
      payment_last_updated_source: existing.payment_last_updated_source,
    },
    updatedValue: {
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      payment_last_updated_source: "manual",
      payment_last_updated_at: now,
    },
    metadata: {
      registration_id: id,
      delta,
    },
    request,
  })

  if (paymentStatus === "paid" || paymentStatus === "overpaid" || delta > 0) {
    const full = await getRegistrationWithAttendees(id)
    if (full) await sendRegistrationEmail(full, "payment_received")
  }

  const registration = await getRegistrationWithAttendees(id)
  const { data: updater } = await admin
    .from("users")
    .select("name")
    .eq("id", auth.sub)
    .maybeSingle()

  return NextResponse.json({
    registration: {
      ...registration,
      payment_last_updated_by_name: updater?.name ?? null,
    },
  })
}
