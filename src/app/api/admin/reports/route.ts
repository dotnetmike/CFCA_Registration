import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { buildDetailedRegistrationsCsv } from "@/lib/dashboard/reports-csv"

const PAYMENT_STATUSES = ["pending", "partial", "paid", "overpaid"] as const

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "reports:read")
  if (forbidden) return forbidden

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format")

  const admin = createAdminClient()
  const { data: registrations, error } = await admin
    .from("registrations")
    .select("*, registration_attendees(*)")
    .order("submitted_at", { ascending: false })

  if (error) return jsonError(error.message, 500)

  const summary: Record<
    string,
    { attendees: number; spouses: number; kids: number; registrations: number }
  > = {}

  const paymentStatusCounts: Record<(typeof PAYMENT_STATUSES)[number], number> = {
    pending: 0,
    partial: 0,
    paid: 0,
    overpaid: 0,
  }

  let totalAttendees = 0
  let totalSpouses = 0
  let totalKids = 0
  let amountDueSum = 0
  let amountPaidSum = 0

  for (const reg of registrations ?? []) {
    const state = reg.state ?? "Unknown"
    if (!summary[state]) {
      summary[state] = { attendees: 0, spouses: 0, kids: 0, registrations: 0 }
    }
    summary[state].registrations += 1
    summary[state].attendees += 1
    totalAttendees += 1

    if (reg.spouse_attending) {
      summary[state].spouses += 1
      totalSpouses += 1
    }

    const kids = (
      (reg.registration_attendees as { age: number }[] | null) ?? []
    ).filter((a) => a.age < 18).length
    summary[state].kids += kids
    totalKids += kids

    const status = String(reg.payment_status ?? "pending")
    if (status in paymentStatusCounts) {
      paymentStatusCounts[status as keyof typeof paymentStatusCounts] += 1
    }

    amountDueSum += Number(reg.amount_due ?? 0)
    amountPaidSum += Number(reg.amount_paid ?? 0)
  }

  const totalRegistrations = (registrations ?? []).length
  const amountRemainingSum = Math.max(0, amountDueSum - amountPaidSum)

  const totals = {
    registrations: totalRegistrations,
    attendees: totalAttendees,
    spouses: totalSpouses,
    kids: totalKids,
    amount_due: amountDueSum,
    amount_paid: amountPaidSum,
    amount_remaining: amountRemainingSum,
  }

  if (format === "csv") {
    const csv = buildDetailedRegistrationsCsv(registrations ?? [])
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registrations.csv"',
      },
    })
  }

  return NextResponse.json({
    registrations,
    summary,
    totals,
    paymentStatusCounts,
  })
}
