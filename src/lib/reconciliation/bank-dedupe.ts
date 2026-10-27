/**
 * Same bank transaction across different CBA exports: the statement export has a Balance column and the
 * transaction-history export does not, so their fingerprints differ. Date + amount + description is the
 * part both exports share.
 */
export const bankLineContentKey = (transactionDate: string, amountCents: number, description: string) =>
  [transactionDate, amountCents, description.trim().replace(/\s+/g, " ").toUpperCase()].join("|")

type BankLineContent = { transactionDate: string; amountCents: number; description: string }

const keyOf = (line: BankLineContent) =>
  bankLineContentKey(line.transactionDate, line.amountCents, line.description)

/**
 * Of the lines whose fingerprint is new, keeps only as many per date + amount + description as the file has
 * beyond what is already stored. Two identical transfers on the same day in one file still both count.
 */
export const selectNewBankLines = <T extends BankLineContent>(
  fileLines: T[],
  freshLines: T[],
  storedCounts: Map<string, number>
): T[] => {
  const allowance = new Map<string, number>()
  for (const line of fileLines) allowance.set(keyOf(line), (allowance.get(keyOf(line)) ?? 0) + 1)
  for (const [key, stored] of storedCounts) {
    if (allowance.has(key)) allowance.set(key, (allowance.get(key) ?? 0) - stored)
  }
  return freshLines.filter((line) => {
    const remaining = allowance.get(keyOf(line)) ?? 0
    if (remaining <= 0) return false
    allowance.set(keyOf(line), remaining - 1)
    return true
  })
}

export type StoredBankLine = {
  id: string
  transactionDate: string
  amountCents: number
  description: string
  runId: string | null
  createdAt: string
}

/**
 * Stored lines that repeat a transaction already imported from another file. Per date + amount + description,
 * the real count is the most any single import contained; the earliest-imported lines up to that count are
 * kept and the rest are duplicates.
 */
export const findDuplicateBankLines = <T extends StoredBankLine>(lines: T[]): T[] => {
  const groups = new Map<string, T[]>()
  for (const line of lines) groups.set(keyOf(line), [...(groups.get(keyOf(line)) ?? []), line])

  return [...groups.values()].flatMap((group) => {
    const perRun = new Map<string, number>()
    for (const line of group) perRun.set(line.runId ?? line.id, (perRun.get(line.runId ?? line.id) ?? 0) + 1)
    const realCount = Math.max(...perRun.values())
    return [...group]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
      .slice(realCount)
  })
}
