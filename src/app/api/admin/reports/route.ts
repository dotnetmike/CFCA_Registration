import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"

/** Never export token / secret columns even if present on the row. */
const CSV_EXCLUDED_KEYS = new Set([
  "view_token_hash",
  "view_token_created_at",
  "signup_token_hash",
  "signup_token_expires_at",
])

const NESTED_RELATION_KEY = "registration_attendees"

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

/**
 * Dynamic detailed CSV: union of all non-secret registration columns
 * so newly added registrant attributes appear automatically.
 */
export const buildDetailedRegistrationsCsv = (
  registrations: Record<string, unknown>[]
) => {
  const columnSet = new Set<string>()
  for (const reg of registrations) {
    for (const key of Object.keys(reg)) {
      if (CSV_EXCLUDED_KEYS.has(key)) continue
      if (key === NESTED_RELATION_KEY) continue
      columnSet.add(key)
    }
  }

  const baseColumns = [...columnSet].sort((a, b) => a.localeCompare(b))
  const headers = [...baseColumns, "registration_attendees_json", "kids_count", "attendees_count"]

  const rows = registrations.map((reg) => {
    const attendees = (reg[NESTED_RELATION_KEY] as unknown[] | null) ?? []
    const kidsCount = attendees.filter(
      (a) => typeof a === "object" && a && Number((a as { age?: number }).age) < 18
    ).length

    return [
      ...baseColumns.map((col) => serializeCsvCell(reg[col])),
      serializeCsvCell(attendees),
      String(kidsCount),
      String(attendees.length),
    ]
  })

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}

const serializeCsvCell = (val: unknown) => {
  if (val == null) return csvEscape("")
  if (typeof val === "object") return csvEscape(JSON.stringify(val))
  return csvEscape(val)
}

const csvEscape = (val: unknown) => {
  const str = String(val ?? "")
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
