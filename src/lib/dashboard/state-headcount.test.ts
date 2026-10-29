import { test } from "node:test"
import assert from "node:assert/strict"
import { adultCount, buildStateHeadcounts, formatHeadcountAsOf } from "./state-headcount"
import type { ReportsStateRow } from "./reports-cache"

const row = (registrants: number, spouses: number, additionalAdults: number, kids: number): ReportsStateRow => ({
  registrants,
  spouses,
  additionalAdults,
  kids,
  people: registrants + spouses + additionalAdults + kids,
  registrations: registrants,
})

test("adultCount excludes kids and tolerates missing fields", () => {
  assert.equal(adultCount(row(2, 1, 1, 3)), 4)
  assert.equal(adultCount({ registrants: 1 }), 1)
  assert.equal(adultCount(undefined), 0)
})

test("buildStateHeadcounts lists every state, including zero counts", () => {
  const report = buildStateHeadcounts({ VIC: row(30, 25, 11, 9), WA: row(5, 5, 0, 2) })
  assert.deepEqual(
    report.states.map((s) => s.state),
    ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]
  )
  assert.equal(report.states.find((s) => s.state === "VIC")?.adults, 66)
  assert.equal(report.states.find((s) => s.state === "WA")?.adults, 10)
  assert.equal(report.states.find((s) => s.state === "SA")?.adults, 0)
  assert.equal(report.total, 76)
  assert.equal(report.unassigned, 0)
})

test("buildStateHeadcounts adds unrecognised states to the total as unassigned", () => {
  const report = buildStateHeadcounts({ NSW: row(2, 2, 0, 0), Unknown: row(1, 0, 0, 1) })
  assert.equal(report.unassigned, 1)
  assert.equal(report.total, 5)
})

test("formatHeadcountAsOf uses the Melbourne calendar date", () => {
  assert.equal(formatHeadcountAsOf(Date.parse("2026-10-27T14:30:00Z")), "28 Oct 2026")
})
