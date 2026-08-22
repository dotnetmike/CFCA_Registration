/** Never export token / secret columns even if present on the row. */
const CSV_EXCLUDED_KEYS = new Set([
  "view_token_hash",
  "view_token_created_at",
  "signup_token_hash",
  "signup_token_expires_at",
])

const NESTED_RELATION_KEY = "registration_attendees"
const SOUVENIR_ORDERS_KEY = "souvenir_orders"

const TSHIRT_SIZE_LABELS: Record<string, string> = {
  S: "Small (S)",
  M: "Medium (M)",
  L: "Large (L)",
  XL: "XL",
  "2XL": "2XL",
}

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

const formatSouvenirOrders = (value: unknown) => {
  if (!Array.isArray(value)) return ""

  const parts = value
    .map((row) => {
      if (!row || typeof row !== "object") return ""
      const line = row as { size?: unknown; quantity?: unknown }
      const size = String(line.size ?? "").trim()
      const qty = Number(line.quantity ?? 0)
      if (!size || !Number.isFinite(qty) || qty <= 0) return ""
      const sizeLabel = TSHIRT_SIZE_LABELS[size] ?? size
      return `${Math.floor(qty)} x ${sizeLabel}`
    })
    .filter((part) => part.length > 0)

  return parts.join(", ")
}

const formatAdditionalAttendees = (value: unknown) => {
  if (!Array.isArray(value)) return ""

  const parts = value
    .map((row) => {
      if (!row || typeof row !== "object") return ""
      const attendee = row as {
        given_name?: unknown
        surname?: unknown
        age?: unknown
        needs_kids_supervision?: unknown
      }

      const given = String(attendee.given_name ?? "").trim()
      const surname = String(attendee.surname ?? "").trim()
      const fullName = [given, surname].filter(Boolean).join(" ").trim() || "Unnamed attendee"

      const ageNum = Number(attendee.age ?? 0)
      const age = Number.isFinite(ageNum) ? Math.floor(ageNum) : 0
      const kidsSupervision = attendee.needs_kids_supervision ? " (kids supervision)" : ""

      return `${fullName} (age ${age})${kidsSupervision}`
    })
    .filter((part) => part.length > 0)

  return parts.join(", ")
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
  const headers = [...baseColumns, "additional_attendees", "kids_count", "attendees_count"]

  const rows = registrations.map((reg) => {
    const attendees = (reg[NESTED_RELATION_KEY] as unknown[] | null) ?? []
    const kidsCount = attendees.filter(
      (a) => typeof a === "object" && a && Number((a as { age?: number }).age) < 18
    ).length

    return [
      ...baseColumns.map((col) => {
        if (col === SOUVENIR_ORDERS_KEY) {
          return serializeCsvCell(formatSouvenirOrders(reg[col]))
        }
        return serializeCsvCell(reg[col])
      }),
      serializeCsvCell(formatAdditionalAttendees(attendees)),
      String(kidsCount),
      String(attendees.length),
    ]
  })

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
}
