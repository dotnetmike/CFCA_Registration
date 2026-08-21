import assert from "node:assert/strict"
import test from "node:test"

import {
  getAirportTransportDateWindow,
  getAirportTransportValidationError,
  isAustralianMobileNumber,
} from "./schema"

test("accepts valid Australian mobile numbers", () => {
  assert.equal(isAustralianMobileNumber("0400123456"), true)
  assert.equal(isAustralianMobileNumber("+61400123456"), true)
  assert.equal(isAustralianMobileNumber("0412 345 678"), true)
})

test("rejects invalid Australian mobile numbers", () => {
  assert.equal(isAustralianMobileNumber("12345"), false)
  assert.equal(isAustralianMobileNumber("abc"), false)
  assert.equal(isAustralianMobileNumber("+1-555-123-4567"), false)
})

test("restricts airport pickup dates to the conference window and CFCA exception positions", () => {
  assert.deepEqual(getAirportTransportDateWindow("pickup", "member"), {
    min: "2027-04-09",
    max: "2027-04-10",
  })

  assert.deepEqual(getAirportTransportDateWindow("pickup", "chapter_leader"), {
    min: "2027-04-08",
    max: "2027-04-10",
  })

  assert.equal(getAirportTransportValidationError("pickup", "member", "2027-04-08"), "Please choose a pickup date between Friday, 9 April 2027 and Saturday, 10 April 2027.")
  assert.equal(getAirportTransportValidationError("pickup", "chapter_leader", "2027-04-07"), "Please choose a pickup date between Thursday, 8 April 2027 and Saturday, 10 April 2027 for this CFCA position.")
})

test("restricts dropoff dates to the conference end date", () => {
  assert.deepEqual(getAirportTransportDateWindow("dropoff", "member"), {
    min: "2027-04-10",
    max: "2027-04-11",
  })

  assert.equal(getAirportTransportValidationError("dropoff", "member", "2027-04-09"), "Please choose a drop-off date between Saturday, 10 April 2027 and Sunday, 11 April 2027.")
})
