import assert from "node:assert/strict"
import test from "node:test"

import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing/calculate"
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
  "early_bird_pricing_updated",
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

const pricing = (overrides: Partial<PricingConfig> = {}): PricingConfig => ({
  ...DEFAULT_PRICING_CONFIG,
  earlyBirdEnd: "2099-01-31",
  earlyBirdPaymentDueDate: "2099-02-15",
  ...overrides,
})

const earlyBirdRegistration: RegistrationEmailRecord = {
  ...registration,
  is_early_bird: true,
  early_bird_slot: "melbourne",
  spouse_attending: true,
}

test("unpaid early-bird adults get the bulleted early bird reminders with dates and price from settings", () => {
  for (const type of ["registration_submitted", "payment_reminder"] as EmailType[]) {
    const { html, text } = buildRegistrationEmail(earlyBirdRegistration, type, {
      siteUrl: "https://example.test",
      pricing: pricing({ earlyBirdPaymentDueDate: "2099-01-31", adultRegular: 250 }),
    })
    assert.match(html, /Early Bird Registration – Important Reminders/, type)
    assert.match(html, /<li[^>]*><strong>Limited slots:<\/strong> First-paid, first-served basis\.<\/li>/, type)
    assert.match(
      html,
      /<strong>Payment required:<\/strong> Registration is secured only upon receipt and confirmation of full payment\./,
      type
    )
    assert.match(
      html,
      /<strong>Deadline:<\/strong> 31 January 2099 or until all early bird slots are filled, whichever comes first\./,
      type
    )
    assert.match(
      html,
      /<strong>Unpaid registrations:<\/strong> Automatically revert to the regular rate of \$250 per adult once the early bird offer closes\./,
      type
    )
    assert.match(text, /EARLY BIRD REGISTRATION – IMPORTANT REMINDERS\n- Limited slots: First-paid, first-served basis\./, type)
    assert.match(text, /- Deadline: 31 January 2099 or until/, type)
  }
})

test("no early bird reminders once paid, after the due date, or without pricing", () => {
  const paid = { ...earlyBirdRegistration, amount_paid: 440, payment_status: "paid" }
  const cases: [RegistrationEmailRecord, PricingConfig | undefined][] = [
    [paid, pricing()],
    [earlyBirdRegistration, pricing({ earlyBirdEnd: "2000-01-01", earlyBirdPaymentDueDate: "2000-01-01" })],
    [earlyBirdRegistration, undefined],
    [{ ...earlyBirdRegistration, is_early_bird: false, early_bird_slot: "none" }, pricing()],
  ]
  for (const [record, config] of cases) {
    const { html, text } = buildRegistrationEmail(record, "payment_reminder", {
      siteUrl: "https://example.test",
      pricing: config,
    })
    assert.doesNotMatch(html, /Important Reminders/)
    assert.doesNotMatch(text, /IMPORTANT REMINDERS/)
  }
})

test("early bird pricing update email explains the change and shows old and new fees", () => {
  const { subject, html, text } = buildRegistrationEmail(
    { ...earlyBirdRegistration, amount_due: 460, amount_paid: 220, payment_status: "partial" },
    "early_bird_pricing_updated",
    {
      siteUrl: "https://example.test",
      pricing: pricing({ earlyBirdPaymentDueDate: "2027-01-31" }),
      earlyBirdChange: {
        reason: "payment_due_passed",
        previousAmountDue: 440,
        adultsMoved: 1,
        adultsKeptEarlyBird: 1,
      },
    }
  )
  assert.equal(subject, "2027 CFCA National Conference Registration Fee Updated (Early Bird) — VIC_TEST_001")
  assert.match(html, /required full payment by 31 January 2027/)
  assert.match(html, /Payment for 1 adult on your registration had not been received by then, so that adult moves/)
  assert.match(html, /1 adult already covered by your payment keeps the early bird rate/)
  assert.match(html, /Previous registration fee[\s\S]*\$440\.00/)
  assert.match(html, /New registration fee[\s\S]*\$460\.00/)
  assert.match(html, /Balance due[\s\S]*\$240\.00/)
  assert.match(text, /Previous registration fee: \$440\.00/)
  assert.match(text, /New registration fee: \$460\.00/)
})

test("capacity-reached update names the pool and only mentions moved adults", () => {
  const { html } = buildRegistrationEmail(
    { ...earlyBirdRegistration, state: "NSW", amount_due: 480 },
    "early_bird_pricing_updated",
    {
      siteUrl: "https://example.test",
      pricing: pricing(),
      earlyBirdChange: {
        reason: "capacity_reached",
        previousAmountDue: 440,
        adultsMoved: 2,
        adultsKeptEarlyBird: 0,
      },
    }
  )
  assert.match(html, /Early bird places for interstate delegates have now been filled by paid registrations/)
  assert.match(html, /2 adults on your registration not yet covered by payment move to the regular rate/)
  assert.doesNotMatch(html, /keep the early bird rate/)
})
