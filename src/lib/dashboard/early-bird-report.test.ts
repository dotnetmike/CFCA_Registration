import { test } from "node:test"
import assert from "node:assert/strict"
import {
  buildEarlyBirdCsv,
  earlyBirdStateBars,
  isPoolNearlyFull,
  niceAxis,
  percentOf,
  poolSegments,
  summarizeEarlyBird,
} from "./early-bird-report"
import type { EarlyBirdPool, EarlyBirdUsage } from "./reports-cache"

const pool = (overrides: Partial<EarlyBirdPool>): EarlyBirdPool => ({
  id: "melbourne",
  label: "Victoria",
  capacity: 250,
  used: 26,
  reserved: 40,
  remaining: 224,
  ...overrides,
})

const usage: EarlyBirdUsage = {
  windowStart: "2026-10-01",
  windowEnd: "2027-01-31",
  paymentDueDate: "2027-01-31",
  isOpen: true,
  pools: [
    pool({}),
    pool({ id: "interstate", label: "Interstate (all other states)", capacity: 200, used: 7, reserved: 10, remaining: 193 }),
  ],
  states: [
    { state: "WA", pool: "interstate", used: 0, reserved: 10 },
    { state: "VIC", pool: "melbourne", used: 26, reserved: 40 },
    { state: "NSW", pool: "interstate", used: 4, reserved: 0 },
    { state: "SA", pool: "interstate", used: 0, reserved: 0 },
  ],
}

test("summarizeEarlyBird adds up both capacity groups", () => {
  assert.deepEqual(summarizeEarlyBird(usage), { confirmed: 33, reserved: 50, remaining: 417, capacity: 450 })
})

test("percentOf rounds to one decimal and handles zero capacity", () => {
  assert.equal(percentOf(26, 250), 10.4)
  assert.equal(percentOf(7, 200), 3.5)
  assert.equal(percentOf(5, 0), 0)
})

test("poolSegments splits capacity into confirmed, awaiting and unallocated", () => {
  assert.deepEqual(poolSegments(pool({})), { confirmed: 26, awaiting: 40, unallocated: 184 })
  assert.deepEqual(poolSegments(pool({ capacity: 50, used: 30, reserved: 40 })), {
    confirmed: 30,
    awaiting: 20,
    unallocated: 0,
  })
})

test("isPoolNearlyFull flags 10% or less remaining", () => {
  assert.equal(isPoolNearlyFull(pool({ remaining: 25 })), true)
  assert.equal(isPoolNearlyFull(pool({ remaining: 26 })), false)
})

test("niceAxis picks a round maximum and evenly spaced ticks", () => {
  assert.deepEqual(niceAxis(66), { max: 70, ticks: [0, 10, 20, 30, 40, 50, 60, 70] })
  assert.deepEqual(niceAxis(4).ticks, [0, 1, 2, 3, 4])
  assert.deepEqual(niceAxis(0).max, 5)
})

test("earlyBirdStateBars sorts by total then confirmed", () => {
  assert.deepEqual(
    earlyBirdStateBars(usage).map((row) => `${row.state}:${row.total}`),
    ["VIC:66", "WA:10", "NSW:4", "SA:0"]
  )
})

test("buildEarlyBirdCsv lists groups and states", () => {
  const csv = buildEarlyBirdCsv(usage)
  assert.match(csv, /Victoria,250,26,40,224/)
  assert.match(csv, /VIC,Victoria,26,40,66/)
  assert.match(csv, /WA,Interstate \(all other states\),0,10,10/)
})
