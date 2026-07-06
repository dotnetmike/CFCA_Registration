import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"

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

  const summary: Record<string, { attendees: number; spouses: number; kids: number; registrations: number }> = {}

  for (const reg of registrations ?? []) {
    const state = reg.state ?? "Unknown"
    if (!summary[state]) {
      summary[state] = { attendees: 0, spouses: 0, kids: 0, registrations: 0 }
    }
    summary[state].registrations += 1
    summary[state].attendees += 1
    if (reg.spouse_attending) summary[state].spouses += 1
    const kids = (reg.registration_attendees as { age: number }[] ?? []).filter((a) => a.age < 18).length
    summary[state].kids += kids
  }

  if (format === "csv") {
    const headers = [
      "registration_no", "surname", "given_name", "email", "mobile", "state",
      "cfca_position", "spouse_attending", "payment_status", "amount_due", "amount_paid",
      "accommodation_type", "pickup_melbourne_airport", "dropoff_melbourne_airport",
      "submitted_at", "kids_count",
    ]

    const rows = (registrations ?? []).map((r) => [
      r.registration_no,
      r.surname,
      r.given_name,
      r.email,
      r.mobile,
      r.state,
      r.cfca_position,
      r.spouse_attending,
      r.payment_status,
      r.amount_due,
      r.amount_paid,
      r.accommodation_type,
      r.pickup_melbourne_airport,
      r.dropoff_melbourne_airport,
      r.submitted_at,
      (r.registration_attendees as unknown[] ?? []).length,
    ])

    const csv = [headers.join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="registrations.csv"',
      },
    })
  }

  return NextResponse.json({ registrations, summary })
}

const csvEscape = (val: unknown) => {
  const str = String(val ?? "")
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
