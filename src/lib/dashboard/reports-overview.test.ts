import { test } from "node:test"
import assert from "node:assert/strict"
import {
  adultTotal,
  collectionProgress,
  compositionRows,
  stateRegistrationRows,
  topStateInsight,
} from "./reports-overview"
import { emptyReportsTotals, type ReportsStateRow, type ReportsTotals } from "./reports-cache"

const totals = (overrides: Partial<ReportsTotals>): ReportsTotals => ({ ...emptyReportsTotals(), ...overrides })

const stateRow = (registrations: number): ReportsStateRow => ({
  registrants: registrations,
  spouses: 0,
  additionalAdults: 0,
  kids: 0,
  teens: 0,
  children: 0,
  infants: 0,
  people: registrations,
  registrations,
})

test("adultTotal counts registrants, spouses and additional adults", () => {
  assert.equal(adultTotal(totals({ registrants: 47, spouses: 31, additionalAdults: 5, kids: 3 })), 83)
})

test("collectionProgress shows paid and balance due as shares of fees", () => {
  const progress = collectionProgress(totals({ amount_due: 18635, amount_paid: 7655, amount_remaining: 10980 }))
  assert.equal(progress.collectedPercent, 41.1)
  assert.equal(progress.balancePercent, 58.9)
  assert.ok(Math.abs(progress.collectedWidth + progress.balanceWidth - 100) < 0.01)
})

test("collectionProgress keeps the bar within 100% when payments exceed fees", () => {
  const progress = collectionProgress(totals({ amount_due: 100, amount_paid: 120, amount_remaining: 0 }))
  assert.equal(progress.collectedPercent, 120)
  assert.equal(progress.collectedWidth, 100)
  assert.equal(progress.balanceWidth, 0)
})

test("compositionRows gives each group's share of people", () => {
  const rows = compositionRows(totals({ registrants: 47, spouses: 31, additionalAdults: 5, kids: 3, people: 86 }))
  assert.deepEqual(
    rows.map((row) => [row.label, row.value, row.percent]),
    [
      ["Primary registrants", 47, 54.7],
      ["Spouses", 31, 36],
      ["Additional adults (18+)", 5, 5.8],
      ["Children (under 18)", 3, 3.5],
    ]
  )
})

test("stateRegistrationRows sorts by registrations and topStateInsight names the leader", () => {
  const rows = stateRegistrationRows({ WA: stateRow(5), VIC: stateRow(38), NSW: stateRow(4) }, 47)
  assert.deepEqual(rows.map((row) => row.state), ["VIC", "WA", "NSW"])
  assert.equal(topStateInsight(rows), "Victoria accounts for 80.9% of registrations.")
  assert.equal(topStateInsight([]), "")
})
