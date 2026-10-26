import assert from "node:assert/strict"
import test from "node:test"

import { buildRegistrationEmail, type EmailType, type RegistrationEmailRecord } from "./send"

const registration: RegistrationEmailRecord = {
  id: "00000000-0000-0000-0000-000000000001",
  registration_no: "CFCA27-000999",
  participant_reference: "VIC_TEST_001",
  email: "test.person@example.com",
  given_name: "Test",
  surname: "Person",
  state: "VIC",
  accommodation_type: "self_arranged",
  amount_due: 440,
  amount_paid: 0,
  payment_status: "pending",
  registration_attendees: [],
}

const build = (type: EmailType) =>
  buildRegistrationEmail(registration, type, { siteUrl: "https://example.test", viewToken: "token" })

const mailtoPattern = (address: string) =>
  new RegExp(`href="mailto:${address.replace(/[.@]/g, "\\$&")}\\?subject=[^"]*CFCA27-000999%20\\(VIC_TEST_001\\)`)

const ALL_TYPES: EmailType[] = [
  "registration_submitted",
  "registration_updated",
  "accommodation_updated",
  "payment_received",
  "payment_reminder",
]

test("every registration email has the Need help card and payment support link", () => {
  for (const type of ALL_TYPES) {
    const { html, text } = build(type)
    assert.match(html, /Need help\?/, type)
    assert.match(html, mailtoPattern("support@cfcanatcon.com"), type)
    assert.match(html, mailtoPattern("payment@cfcanatcon.com"), type)
    assert.match(text, /Ask a question: email support@cfcanatcon\.com/, type)
    assert.match(text, /Ask about conference payment: email payment@cfcanatcon\.com/, type)
  }
})

test("full-details emails include the accommodation support link", () => {
  for (const type of ALL_TYPES.slice(0, 3)) {
    const { html, text } = build(type)
    assert.match(html, mailtoPattern("accomodation@cfcanatcon.com"), type)
    assert.match(text, /Ask about accommodation or transport: email accomodation@cfcanatcon\.com/, type)
  }
})

test("existing subjects and links are unchanged", () => {
  const { subject, html } = build("registration_submitted")
  assert.equal(subject, "2027 CFCA National Conference Registration Confirmed — VIC_TEST_001")
  assert.match(html, /href="https:\/\/example\.test\/r\/token"/)
  assert.match(html, /href="https:\/\/example\.test\/register\/pay\?view=token"/)
})
