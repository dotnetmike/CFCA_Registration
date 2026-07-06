import { getRegistrationCodePrefix } from "@/lib/supabase/env"

export type ParsedTransaction = {
  transaction_date: string | null
  description: string
  amount: number
  extracted_reference: string
  match_confidence: number
}

const AMOUNT_PATTERN = /[\$]?\s*([\d,]+\.\d{2})/
const DATE_PATTERN = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/

export const extractRegistrationReferences = (text: string): string[] => {
  const prefix = getRegistrationCodePrefix()
  const pattern = new RegExp(`${prefix}-\\d{6}`, "gi")
  return [...new Set(text.match(pattern)?.map((m) => m.toUpperCase()) ?? [])]
}

export const parseBankStatementText = (text: string): ParsedTransaction[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const prefix = getRegistrationCodePrefix()
  const refPattern = new RegExp(`${prefix}-\\d{6}`, "i")
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    const refMatch = line.match(refPattern)
    if (!refMatch) continue

    const amountMatch = line.match(AMOUNT_PATTERN)
    const dateMatch = line.match(DATE_PATTERN)

    const amount = amountMatch
      ? parseFloat(amountMatch[1].replace(/,/g, ""))
      : 0

    transactions.push({
      transaction_date: dateMatch ? normalizeDate(dateMatch[1]) : null,
      description: line,
      amount: Math.abs(amount),
      extracted_reference: refMatch[0].toUpperCase(),
      match_confidence: amount > 0 ? 0.9 : 0.5,
    })
  }

  if (transactions.length === 0) {
    const refs = extractRegistrationReferences(text)
    for (const ref of refs) {
      const refIndex = text.indexOf(ref)
      const context = text.slice(Math.max(0, refIndex - 50), refIndex + 100)
      const amountMatch = context.match(AMOUNT_PATTERN)
      transactions.push({
        transaction_date: null,
        description: context.trim(),
        amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0,
        extracted_reference: ref,
        match_confidence: amountMatch ? 0.7 : 0.4,
      })
    }
  }

  return transactions
}

const normalizeDate = (raw: string): string | null => {
  const parts = raw.includes("/") ? raw.split("/") : raw.split("-")
  if (parts.length !== 3) return null

  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
  }

  const [d, m, y] = parts
  const year = y.length === 2 ? `20${y}` : y
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
}

export const parseBankPdf = async (buffer: Buffer): Promise<{
  text: string
  transactions: ParsedTransaction[]
}> => {
  const pdfParse = (await import("pdf-parse")).default
  const result = await pdfParse(buffer)
  const text = result.text
  return { text, transactions: parseBankStatementText(text) }
}
