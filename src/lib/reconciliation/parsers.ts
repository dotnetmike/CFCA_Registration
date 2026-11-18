import { createHash } from "node:crypto"
import type { BankLineKind } from "@/lib/reconciliation/types"

export class ReconciliationFileError extends Error {}

export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  const input = text.replace(/^\uFEFF/, "")

  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++
      row.push(field)
      if (row.some((cell) => cell.trim() !== "")) rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.trim() !== "")) rows.push(row)
  }
  return rows
}

/** "$2,869.99", "-$50.00", "(50.00)", "+220" → cents. */
export const parseMoneyToCents = (value: string): number | null => {
  const raw = value.trim()
  if (!raw) return null
  const negative = /^\(.*\)$/.test(raw) || raw.includes("-")
  const digits = raw.replace(/[^0-9.]/g, "")
  if (!digits || !/^\d*\.?\d*$/.test(digits)) return null
  const cents = Math.round(Number(digits) * 100)
  if (!Number.isFinite(cents)) return null
  return negative ? -cents : cents
}

const pad = (n: number) => String(n).padStart(2, "0")

const isValidDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

type DateOrder = "dmy" | "mdy"

const SLASH_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
const ISO_DATE = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
const MONTH_NAMES =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december"
const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}
const DAY_MONTH_NAME = new RegExp(
  `^(\\d{1,2})[\\s\\-]+(${MONTH_NAMES})[\\s\\-]+(\\d{2,4})(?:[ T](\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?$`,
  "i"
)
const MONTH_NAME_DAY = new RegExp(
  `^(${MONTH_NAMES})[\\s\\-]+(\\d{1,2}),?[\\s\\-]+(\\d{2,4})(?:[ T](\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?$`,
  "i"
)

/** Day/month order for a column of slash dates: a part above 12 decides it, otherwise Australian d/m/y. */
const detectDateOrder = (values: string[]): DateOrder => {
  for (const value of values) {
    const match = value.trim().match(SLASH_DATE)
    if (!match) continue
    if (Number(match[1]) > 12) return "dmy"
    if (Number(match[2]) > 12) return "mdy"
  }
  return "dmy"
}

type ParsedDateTime = { date: string; iso: string }

const buildParsedDate = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number
): ParsedDateTime | null => {
  if (!isValidDate(year, month, day) || hours > 23 || minutes > 59 || seconds > 59) return null
  const date = `${year}-${pad(month)}-${pad(day)}`
  return { date, iso: `${date}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}Z` }
}

const yearFromToken = (token: string) => Number(token.length === 2 ? `20${token}` : token)

const parseDateTime = (value: string, order: DateOrder): ParsedDateTime | null => {
  const raw = value.trim()
  if (!raw) return null

  const iso = raw.match(ISO_DATE)
  if (iso) {
    return buildParsedDate(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0)
    )
  }

  const dayMonthName = raw.match(DAY_MONTH_NAME)
  if (dayMonthName) {
    const month = MONTH_INDEX[dayMonthName[2].toLowerCase()]
    if (!month) return null
    return buildParsedDate(
      yearFromToken(dayMonthName[3]),
      month,
      Number(dayMonthName[1]),
      Number(dayMonthName[4] ?? 0),
      Number(dayMonthName[5] ?? 0),
      Number(dayMonthName[6] ?? 0)
    )
  }

  const monthNameDay = raw.match(MONTH_NAME_DAY)
  if (monthNameDay) {
    const month = MONTH_INDEX[monthNameDay[1].toLowerCase()]
    if (!month) return null
    return buildParsedDate(
      yearFromToken(monthNameDay[3]),
      month,
      Number(monthNameDay[2]),
      Number(monthNameDay[4] ?? 0),
      Number(monthNameDay[5] ?? 0),
      Number(monthNameDay[6] ?? 0)
    )
  }

  const slash = raw.match(SLASH_DATE)
  if (!slash) return null
  const first = Number(slash[1])
  const second = Number(slash[2])
  const day = order === "dmy" ? first : second
  const month = order === "dmy" ? second : first
  return buildParsedDate(
    yearFromToken(slash[3]),
    month,
    day,
    Number(slash[4] ?? 0),
    Number(slash[5] ?? 0),
    Number(slash[6] ?? 0)
  )
}

/** Prefer the file's day/month order; if that fails, try the other order (handles mixed human edits). */
const parseFlexibleDateTime = (value: string, preferred: DateOrder): ParsedDateTime | null => {
  const primary = parseDateTime(value, preferred)
  if (primary) return primary
  const alternate: DateOrder = preferred === "dmy" ? "mdy" : "dmy"
  return parseDateTime(value, alternate)
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

const findColumn = (headers: string[], candidates: string[]) => {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate)
    if (index >= 0) return index
  }
  return -1
}

export type StripeCsvRow = {
  stripeTxnId: string
  type: string
  sourceId: string
  amountCents: number
  feeCents: number
  netCents: number
  currency: string
  createdUtc: string
  availableOnUtc: string
  metadataRegistrationId: string
  metadataParticipantReference: string
  raw: Record<string, string>
}

/** Stripe Balance history export ("All activity") or the itemized balance change report. */
export const parseStripeBalanceHistory = (text: string): StripeCsvRow[] => {
  const [headerRow, ...dataRows] = parseCsv(text)
  if (!headerRow) throw new ReconciliationFileError("The file is empty.")
  const headers = headerRow.map(normalizeHeader)

  const columns = {
    id: findColumn(headers, ["id", "balance_transaction_id"]),
    type: findColumn(headers, ["type", "reporting_category"]),
    source: findColumn(headers, ["source", "source_id"]),
    amount: findColumn(headers, ["amount", "gross"]),
    fee: findColumn(headers, ["fee"]),
    net: findColumn(headers, ["net"]),
    currency: findColumn(headers, ["currency"]),
    created: findColumn(headers, ["created (utc)", "created_utc", "created"]),
    availableOn: findColumn(headers, ["available on (utc)", "available_on_utc", "available on"]),
    registrationId: headers.findIndex((h) => h.includes("registration_id")),
    participantReference: headers.findIndex((h) => h.includes("participant_reference")),
  }

  const required: [keyof typeof columns, string][] = [
    ["id", "id"],
    ["type", "Type"],
    ["amount", "Amount"],
    ["net", "Net"],
    ["created", "Created (UTC)"],
    ["availableOn", "Available On (UTC)"],
  ]
  const missing = required.filter(([key]) => columns[key] < 0).map(([, label]) => label)
  if (missing.length > 0) {
    throw new ReconciliationFileError(
      `This doesn't look like a Stripe balance history export. Missing column(s): ${missing.join(", ")}.`
    )
  }

  const cell = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "")
  const dateValues = dataRows.flatMap((row) => [cell(row, columns.created), cell(row, columns.availableOn)])
  const order = detectDateOrder(dateValues)

  return dataRows.map((row, index) => {
    const line = index + 2
    const stripeTxnId = cell(row, columns.id)
    if (!stripeTxnId) throw new ReconciliationFileError(`Row ${line}: missing Stripe transaction id.`)
    const amountCents = parseMoneyToCents(cell(row, columns.amount))
    const netCents = parseMoneyToCents(cell(row, columns.net))
    const created = parseDateTime(cell(row, columns.created), order)
    const availableOn = parseDateTime(cell(row, columns.availableOn), order) ?? created
    if (amountCents === null || netCents === null || !created || !availableOn) {
      throw new ReconciliationFileError(`Row ${line} (${stripeTxnId}): could not read the amount or dates.`)
    }
    return {
      stripeTxnId,
      type: cell(row, columns.type).toLowerCase(),
      sourceId: cell(row, columns.source),
      amountCents,
      feeCents: parseMoneyToCents(cell(row, columns.fee)) ?? 0,
      netCents,
      currency: (cell(row, columns.currency) || "aud").toLowerCase(),
      createdUtc: created.iso,
      availableOnUtc: availableOn.iso,
      metadataRegistrationId: cell(row, columns.registrationId),
      metadataParticipantReference: cell(row, columns.participantReference),
      raw: Object.fromEntries(headerRow.map((h, i) => [h.trim(), (row[i] ?? "").trim()])),
    }
  })
}

export type BankCsvLine = {
  fingerprint: string
  transactionDate: string
  amountCents: number
  description: string
  balanceCents: number | null
  kind: BankLineKind
  raw: Record<string, string>
}

export const classifyBankLine = (amountCents: number, description: string): BankLineKind => {
  if (amountCents < 0) return "debit"
  if (/\bSTRIPE\b/i.test(description)) return "stripe_payout"
  return "transfer"
}

const BANK_HEADERS = ["date", "amount", "description", "balance"]

export type CbaSkippedRow = { line: number; reason: string }

export type CbaParseResult = {
  lines: BankCsvLine[]
  skipped: CbaSkippedRow[]
}

const cellAt = (row: string[], index: number) => (index >= 0 ? (row[index] ?? "").trim() : "")

const isBlankBankRow = (row: string[], columns: { date: number; amount: number; description: number }) =>
  !cellAt(row, columns.date) && !cellAt(row, columns.amount) && !cellAt(row, columns.description)

/** CommBank NetBank CSV: Date, Amount, Description/Payee, Balance — with or without a header row. */
export const parseCbaStatement = (text: string): CbaParseResult => {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new ReconciliationFileError("The file is empty.")

  const first = rows[0].map(normalizeHeader)
  const hasHeader = parseFlexibleDateTime(rows[0][0] ?? "", "dmy") === null
  const headers = hasHeader ? first : BANK_HEADERS
  const dataRows = hasHeader ? rows.slice(1) : rows

  const columns = {
    date: hasHeader ? findColumn(headers, ["date", "transaction date"]) : 0,
    amount: hasHeader ? findColumn(headers, ["amount", "debit/credit"]) : 1,
    description: hasHeader
      ? findColumn(headers, ["description", "payee", "narrative", "transaction details", "details"])
      : 2,
    balance: hasHeader ? findColumn(headers, ["balance", "total"]) : 3,
  }
  if (columns.date < 0 || columns.amount < 0 || columns.description < 0) {
    throw new ReconciliationFileError(
      "This doesn't look like a CBA statement export. Expected columns: Date, Amount, Description (Payee). Extra columns are ignored."
    )
  }

  const preferredOrder = detectDateOrder(dataRows.map((row) => cellAt(row, columns.date)))
  const occurrences = new Map<string, number>()
  const lines: BankCsvLine[] = []
  const skipped: CbaSkippedRow[] = []
  const headerLabels = hasHeader ? rows[0] : BANK_HEADERS

  for (let index = 0; index < dataRows.length; index++) {
    const row = dataRows[index]
    const line = index + (hasHeader ? 2 : 1)
    if (isBlankBankRow(row, columns)) continue

    const dateRaw = cellAt(row, columns.date)
    const amountRaw = cellAt(row, columns.amount)
    const date = parseFlexibleDateTime(dateRaw, preferredOrder)
    const amountCents = parseMoneyToCents(amountRaw)
    if (!date || amountCents === null) {
      const parts: string[] = []
      if (!date) parts.push(dateRaw ? `unreadable date "${dateRaw}"` : "missing date")
      if (amountCents === null) parts.push(amountRaw ? `unreadable amount "${amountRaw}"` : "missing amount")
      skipped.push({ line, reason: parts.join("; ") })
      continue
    }

    const description = cellAt(row, columns.description).replace(/\s+/g, " ")
    const balanceCents = columns.balance >= 0 ? parseMoneyToCents(cellAt(row, columns.balance)) : null
    const key = [date.date, amountCents, description.toUpperCase(), balanceCents ?? ""].join("|")
    const occurrence = occurrences.get(key) ?? 0
    occurrences.set(key, occurrence + 1)

    lines.push({
      fingerprint: createHash("sha256").update(`${key}|${occurrence}`).digest("hex"),
      transactionDate: date.date,
      amountCents,
      description,
      balanceCents,
      kind: classifyBankLine(amountCents, description),
      raw: Object.fromEntries(headerLabels.map((h, i) => [h.trim(), (row[i] ?? "").trim()])),
    })
  }

  if (lines.length === 0) {
    throw new ReconciliationFileError(
      skipped.length > 0
        ? `No readable transactions found. ${skipped.length} row${skipped.length === 1 ? "" : "s"} could not be read (need a date and amount).`
        : "The file has no transactions."
    )
  }

  return { lines, skipped }
}
