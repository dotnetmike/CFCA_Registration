import assert from "node:assert/strict"
import test from "node:test"

import { buildSupportMailto } from "./contact"

test("support mailto targets the topic address with the registration in the subject", () => {
  const href = buildSupportMailto("payment", {
    registrationNo: "CFCA27-000040",
    uniqueCode: "VIC_TEST_001",
    name: "Test Person",
  })
  const url = new URL(href)
  assert.equal(url.protocol, "mailto:")
  assert.equal(url.pathname, "payment@cfcanatcon.com")
  assert.equal(url.searchParams.get("subject"), "Conference payment question — CFCA27-000040 (VIC_TEST_001)")
  assert.match(url.searchParams.get("body") ?? "", /Registration No: CFCA27-000040\nUnique Code: VIC_TEST_001\nName: Test Person/)
})

test("subject uses only the registration number when there is no separate unique code", () => {
  const url = new URL(buildSupportMailto("general", { registrationNo: "CFCA27-000041", uniqueCode: "CFCA27-000041" }))
  assert.equal(url.pathname, "support@cfcanatcon.com")
  assert.equal(url.searchParams.get("subject"), "Question about my registration — CFCA27-000041")
})
