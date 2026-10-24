import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { buildDetailedRegistrationsCsv } from "@/lib/dashboard/reports-csv"
import { buildReportsSummary } from "@/lib/dashboard/reports-summary"

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

  if (format === "csv") {
    const csv = buildDetailedRegistrationsCsv(registrations ?? [])
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="registrations.csv"',
      },
    })
  }

  const { summary, totals, paymentStatusCounts } = buildReportsSummary(registrations ?? [])

  return NextResponse.json({
    registrations,
    summary,
    totals,
    paymentStatusCounts,
  })
}
