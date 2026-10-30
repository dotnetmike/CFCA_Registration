import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ALL_SELECTABLE_BANDS,
  adultCount,
  bandsForSelection,
  buildStateHeadcounts,
  formatHeadcountAsOf,
  headcountBreakdown,
  headcountForSelection,
  toggleHeadcountBand,
  visibleHeadcountBands,
} from "./state-headcount"
import type { ReportsStateRow } from "./reports-cache"
import { countRegistrationPeople } from "../registrations/people-count"

const row = (
  registrants: number,
  spouses: number,
  additionalAdults: number,
  { teens = 0, children = 0, infants = 0 } = {}
): ReportsStateRow => ({
  registrants,
  spouses,
  additionalAdults,
  teens,
  children,
  infants,
  kids: teens + children + infants,
  people: registrants + spouses + additionalAdults + teens + children + infants,
  registrations: registrants,
})

test("countRegistrationPeople splits attendees into pricing age bands", () => {
  const people = countRegistrationPeople({
    spouse_attending: true,
    registration_attendees: [{ age: 0 }, { age: 2 }, { age: 11 }, { age: 12 }, { age: 17 }, { age: 18 }],
  })
  assert.equal(people.infants, 1)
  assert.equal(people.children, 2)
  assert.equal(people.teens, 2)
  assert.equal(people.additionalAdults, 1)
  assert.equal(people.kids, 5)
  assert.equal(people.people, 8)
})

test("adultCount excludes under-18s and tolerates missing fields", () => {
  assert.equal(adultCount(row(2, 1, 1, { teens: 3 })), 4)
  assert.equal(adultCount({ registrants: 1 }), 1)
  assert.equal(adultCount(undefined), 0)
})

test("headcountBreakdown bands always add up to people", () => {
  const breakdown = headcountBreakdown(row(2, 1, 1, { teens: 1, children: 2, infants: 1 }))
  assert.deepEqual(breakdown, { people: 8, adults: 4, teens: 1, children: 2, infants: 1 })
  assert.deepEqual(headcountBreakdown(undefined), { people: 0, adults: 0, teens: 0, children: 0, infants: 0 })
})

test("buildStateHeadcounts lists every state and the total equals the sum of states", () => {
  const report = buildStateHeadcounts({
    VIC: row(30, 25, 11, { teens: 4, children: 5 }),
    WA: row(5, 5, 0, { children: 2 }),
  })
  assert.deepEqual(
    report.states.map((s) => s.state),
    ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]
  )
  assert.equal(report.states.find((s) => s.state === "VIC")?.people, 75)
  assert.equal(report.states.find((s) => s.state === "SA")?.people, 0)
  assert.deepEqual(report.total, { people: 87, adults: 76, teens: 4, children: 7, infants: 0 })
  assert.equal(
    report.states.reduce((sum, s) => sum + s.people, 0),
    report.total.people
  )
})

test("buildStateHeadcounts adds unrecognised states to the total as unassigned", () => {
  const report = buildStateHeadcounts({ NSW: row(2, 2, 0), Unknown: row(1, 0, 0, { infants: 1 }) })
  assert.deepEqual(report.unassigned, { people: 2, adults: 1, teens: 0, children: 0, infants: 1 })
  assert.deepEqual(report.total, { people: 6, adults: 5, teens: 0, children: 0, infants: 1 })
})

test("visibleHeadcountBands lists infants only when any are registered", () => {
  const empty = { people: 0, adults: 0, teens: 0, children: 0, infants: 0 }
  assert.deepEqual(visibleHeadcountBands(empty).map((b) => b.key), ["children", "teens", "adults"])
  assert.deepEqual(
    visibleHeadcountBands({ ...empty, infants: 1 }).map((b) => b.key),
    ["infants", "children", "teens", "adults"]
  )
})

test("headcountForSelection counts everyone when all groups are ticked and only the chosen groups otherwise", () => {
  const breakdown = { people: 10, adults: 6, teens: 1, children: 2, infants: 1 }
  assert.equal(headcountForSelection(breakdown, ALL_SELECTABLE_BANDS), 10)
  assert.equal(headcountForSelection(breakdown, ["adults"]), 6)
  assert.equal(headcountForSelection(breakdown, ["children", "teens"]), 3)
})

test("bandsForSelection keeps display order and includes infants only when all groups are ticked", () => {
  const total = { people: 10, adults: 6, teens: 1, children: 2, infants: 1 }
  assert.deepEqual(
    bandsForSelection(total, ALL_SELECTABLE_BANDS).map((b) => b.key),
    ["infants", "children", "teens", "adults"]
  )
  assert.deepEqual(bandsForSelection(total, ["adults", "children"]).map((b) => b.key), ["children", "adults"])
  assert.equal(bandsForSelection(total, ["teens"])[0].note, "Teens 12–17 only")
})

test("toggleHeadcountBand adds and removes a group but never removes the last one", () => {
  assert.deepEqual(toggleHeadcountBand(["teens"], "adults"), ["teens", "adults"])
  assert.deepEqual(toggleHeadcountBand(["adults", "teens"], "adults"), ["teens"])
  assert.deepEqual(toggleHeadcountBand(["teens"], "teens"), ["teens"])
})

test("formatHeadcountAsOf uses the Melbourne calendar date", () => {
  assert.equal(formatHeadcountAsOf(Date.parse("2026-10-27T14:30:00Z")), "28 Oct 2026")
})
