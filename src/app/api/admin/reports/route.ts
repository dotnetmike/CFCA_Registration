import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { buildDetailedRegistrationsCsv } from "@/lib/dashboard/reports-csv"

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

  for (const reg of registrations ?? []) {
    const state = reg.state ?? "Unknown"
    if (!summary[state]) {
      summary[state] = { attendees: 0, spouses: 0, kids: 0, registrations: 0 }
    }
    summary[state].registrations += 1
    summary[state].attendees += 1
    if (reg.spouse_attending) summary[state].spouses += 1
    const kids = (
      (reg.registration_attendees as { age: number }[] | null) ?? []
    ).filter((a) => a.age < 18).length
    summary[state].kids += kids
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

  return NextResponse.json({ registrations, summary })
}
