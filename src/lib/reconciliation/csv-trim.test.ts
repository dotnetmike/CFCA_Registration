import assert from "node:assert/strict"
import test from "node:test"
import { trimEmptyCsvLines } from "./csv-trim"

test("trimEmptyCsvLines keeps data rows and drops Excel blank padding", () => {
  const trimmed = trimEmptyCsvLines(
    `\uFEFFDate, Amount, Payee, Total\n17/11/2026,$540.00,Fast Transfer From A,$1.00\n,,,\n,,, \n\n`
  )
  assert.equal(
    trimmed,
    "Date, Amount, Payee, Total\n17/11/2026,$540.00,Fast Transfer From A,$1.00"
  )
})

test("trimEmptyCsvLines keeps amounts that use dollars and commas", () => {
  const trimmed = trimEmptyCsvLines(`Date,Amount\n1/11/2026,"$2,368.58"\n,,,`)
  assert.equal(trimmed, `Date,Amount\n1/11/2026,"$2,368.58"`)
})
