import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createEmailPacer,
  isEarliestRun,
  registrationsAwaitingRepricing,
  remindedRegistrationIds,
} from "./payment-reminders"

const fakeClock = (start = 0) => {
  let current = start
  return {
    now: () => current,
    wait: async (ms: number) => {
      current += ms
    },
    advance: (ms: number) => {
      current += ms
    },
  }
}

test("pacer spaces email starts by the interval", async () => {
  const clock = fakeClock()
  const pacer = createEmailPacer({ deadlineMs: 100_000, intervalMs: 2500, now: clock.now, wait: clock.wait })
  const starts: number[] = []
  for (let i = 0; i < 3; i++) {
    await pacer.waitForTurn()
    starts.push(clock.now())
    clock.advance(1000)
  }
  assert.deepEqual(starts, [0, 2500, 5000])
})

test("pacer does not wait when a send already took longer than the interval", async () => {
  const clock = fakeClock()
  const pacer = createEmailPacer({ deadlineMs: 100_000, intervalMs: 2500, now: clock.now, wait: clock.wait })
  await pacer.waitForTurn()
  clock.advance(4000)
  await pacer.waitForTurn()
  assert.equal(clock.now(), 4000)
})

test("pacer reports no time once the next start would pass the deadline", async () => {
  const clock = fakeClock()
  const pacer = createEmailPacer({ deadlineMs: 6000, intervalMs: 2500, now: clock.now, wait: clock.wait })
  assert.equal(pacer.hasTimeForAnother(), true)
  await pacer.waitForTurn()
  await pacer.waitForTurn()
  assert.equal(clock.now(), 2500)
  assert.equal(pacer.hasTimeForAnother(), true)
  await pacer.waitForTurn()
  assert.equal(clock.now(), 5000)
  assert.equal(pacer.hasTimeForAnother(), false)
})

test("remindedRegistrationIds counts successful reminders on the Melbourne date only", () => {
  const ids = remindedRegistrationIds(
    [
      { registration_id: "a", sent_at: "2026-10-26T22:05:00+00:00", resend_id: "graph:x" },
      { registration_id: "b", sent_at: "2026-10-26T12:00:00+00:00", resend_id: "graph:x" },
      { registration_id: "c", sent_at: "2026-10-26T22:06:00+00:00", resend_id: null },
      { registration_id: null, sent_at: "2026-10-26T22:07:00+00:00", resend_id: "graph:x" },
    ],
    "2026-10-27"
  )
  assert.deepEqual([...ids], ["a"])
})

test("registrationsAwaitingRepricing holds skipped and deferred registrations", () => {
  const held = registrationsAwaitingRepricing({ skipped: ["CFCA27-000001"], deferred: ["CFCA27-000002"] })
  assert.deepEqual([...held].sort(), ["CFCA27-000001", "CFCA27-000002"])
  assert.equal(registrationsAwaitingRepricing({ skipped: [], deferred: [] }).size, 0)
})

test("isEarliestRun lets only the first run in the window proceed", () => {
  const rows = [
    { id: "2", created_at: "2026-10-26T22:00:01.5+00:00", metadata: { run_id: "late" } },
    { id: "1", created_at: "2026-10-26T22:00:01.25+00:00", metadata: { run_id: "early" } },
  ]
  assert.equal(isEarliestRun(rows, "early"), true)
  assert.equal(isEarliestRun(rows, "late"), false)
})

test("isEarliestRun breaks timestamp ties by id and proceeds when no rows are visible", () => {
  const at = "2026-10-26T22:00:00+00:00"
  const rows = [
    { id: "b", created_at: at, metadata: { run_id: "second" } },
    { id: "a", created_at: at, metadata: { run_id: "first" } },
  ]
  assert.equal(isEarliestRun(rows, "first"), true)
  assert.equal(isEarliestRun(rows, "second"), false)
  assert.equal(isEarliestRun([], "any"), true)
})
