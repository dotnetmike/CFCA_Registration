const MELBOURNE_DATE_TIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const PLAIN_DATE = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
})

export const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "—" : MELBOURNE_DATE_TIME.format(date)
}

/** Formats a calendar date (YYYY-MM-DD) without shifting it across time zones. */
export const formatCalendarDate = (ymd: string | null | undefined) => {
  if (!ymd) return "—"
  const date = new Date(`${ymd.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? "—" : PLAIN_DATE.format(date)
}

export const includesSearch = (search: string, values: (string | number | null | undefined)[]) => {
  const needle = search.trim().toLowerCase()
  if (!needle) return true
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle))
}
