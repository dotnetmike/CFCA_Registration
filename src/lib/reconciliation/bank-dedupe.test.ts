import { test } from "node:test"
import assert from "node:assert/strict"
import { bankLineContentKey, findDuplicateBankLines, selectNewBankLines } from "./bank-dedupe"

const line = (id: string, date: string, cents: number, description: string) => ({
  id,
  transactionDate: date,
  amountCents: cents,
  description,
})

test("bankLineContentKey ignores case and extra spaces", () => {
  assert.equal(
    bankLineContentKey("2026-10-21", 22000, "Fast Transfer  From A VIC_X_001 "),
    bankLineContentKey("2026-10-21", 22000, "FAST TRANSFER FROM A VIC_X_001")
  )
})

test("selectNewBankLines skips a transaction already stored from an export with a balance column", () => {
  const vicencio = line("a", "2026-10-21", 22000, "Fast Transfer From MS MARIA VIC_VICENCIO_001")
  const pelaez = line("b", "2026-10-26", 22000, "Fast Transfer From MS MARIA VIC_PELAEZ_001")
  const stored = new Map([[bankLineContentKey(vicencio.transactionDate, 22000, vicencio.description), 1]])
  assert.deepEqual(selectNewBankLines([vicencio, pelaez], [vicencio, pelaez], stored), [pelaez])
})

test("selectNewBankLines keeps two identical transfers on the same day when neither is stored", () => {
  const first = line("a", "2026-10-20", 22000, "Fast Transfer From A VIC_A_001")
  const second = line("b", "2026-10-20", 22000, "Fast Transfer From A VIC_A_001")
  assert.deepEqual(selectNewBankLines([first, second], [first, second], new Map()), [first, second])
})

test("selectNewBankLines adds only the extra copy when one of two identical transfers is stored", () => {
  const first = line("a", "2026-10-20", 22000, "Fast Transfer From A VIC_A_001")
  const second = line("b", "2026-10-20", 22000, "Fast Transfer From A VIC_A_001")
  const stored = new Map([[bankLineContentKey("2026-10-20", 22000, first.description), 1]])
  assert.deepEqual(selectNewBankLines([first, second], [first, second], stored), [first])
})

const stored = (id: string, runId: string, createdAt: string, description = "Fast Transfer VIC_A_001") => ({
  ...line(id, "2026-10-20", 22000, description),
  runId,
  createdAt,
})

test("findDuplicateBankLines flags the later import of the same transaction", () => {
  const original = stored("a", "run1", "2026-10-22T06:41:33Z")
  const repeat = stored("b", "run2", "2026-10-27T09:11:18Z")
  assert.deepEqual(findDuplicateBankLines([repeat, original]), [repeat])
})

test("findDuplicateBankLines keeps genuine same-day repeats from one import", () => {
  const lines = [
    stored("a", "run1", "2026-10-22T06:41:33Z"),
    stored("b", "run1", "2026-10-22T06:41:33Z"),
    stored("c", "run2", "2026-10-27T09:11:18Z"),
    stored("d", "run2", "2026-10-27T09:11:18Z"),
  ]
  assert.deepEqual(
    findDuplicateBankLines(lines).map((l) => l.id),
    ["c", "d"]
  )
})

test("findDuplicateBankLines leaves different transactions alone", () => {
  const lines = [
    stored("a", "run1", "2026-10-22T06:41:33Z", "Fast Transfer VIC_A_001"),
    stored("b", "run2", "2026-10-27T09:11:18Z", "Direct Credit VIC_A_001"),
  ]
  assert.deepEqual(findDuplicateBankLines(lines), [])
})
