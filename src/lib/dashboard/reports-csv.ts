/** Never export token / secret columns even if present on the row. */
const CSV_EXCLUDED_KEYS = new Set([
  "view_token_hash",
  "view_token_created_at",
  "signup_token_hash",
  "signup_token_expires_at",
])

const NESTED_RELATION_KEY = "registration_attendees"

const csvEscape = (val: unknown) => {
  const str = String(val ?? "")
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const serializeCsvCell = (val: unknown) => {
  if (val == null) return csvEscape("")
  if (typeof val === "object") return csvEscape(JSON.stringify(val))
  return csvEscape(val)
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
