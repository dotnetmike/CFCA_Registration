import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency, type PricingConfig } from "@/lib/pricing/calculate"
import {
  EARLY_BIRD_REMINDERS_TITLE,
  earlyBirdReminders,
  earlyBirdPoolForState,
  showsEarlyBirdReminders,
  formatAdultCount,
  formatEarlyBirdDate,
} from "@/lib/pricing/early-bird"
import { CFCA_POSITION_LABELS, MINISTRY_LABELS } from "@/lib/registrations/schema"
import {
  booleansToTransportOption,
  getAccommodationLabel,
  getTransportOptionLabel,
} from "@/lib/registrations/transport"
import {
  formatSouvenirOrdersSummary,
  hasSouvenirPreOrder,
  souvenirTotalAmount,
} from "@/lib/registrations/souvenirs"
import { getRequestSiteUrl } from "@/lib/site-url"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import {
  bankTransferNoticeHtml,
  remindersCalloutHtml,
  paragraphHtml,
  renderEmail,
  getEmailLogoAttachment,
  assertEmailIncludesLogo,
  type EmailDetailsCard,
  type EmailHelpCard,
  type EmailReminders,
  type EmailLink,
  type EmailRow,
  type EmailStatusTone,
} from "@/lib/email/template"
import { sendTransactionalEmail } from "@/lib/email/provider"
import {
  SUPPORT_CONTACTS,
  SUPPORT_HELP_TEXT,
  buildSupportMailto,
  type SupportTopic,
} from "@/lib/support/contact"
import {
  BANK_TRANSFER_ENCOURAGEMENT,
  PAYMENT_LABELS,
  balanceDue,
  formatPaymentStatus,
} from "@/lib/payments/labels"

export type EmailType =
  | "registration_submitted"
  | "registration_updated"
  | "accommodation_updated"
  | "payment_received"
  | "payment_reminder"
  | "early_bird_pricing_updated"

/** `email_log.email_type` is a DB enum; types without their own value are logged under the closest one. */
const EMAIL_LOG_TYPE: Record<EmailType, Exclude<EmailType, "early_bird_pricing_updated">> = {
  registration_submitted: "registration_submitted",
  registration_updated: "registration_updated",
  accommodation_updated: "accommodation_updated",
  payment_received: "payment_received",
  payment_reminder: "payment_reminder",
  early_bird_pricing_updated: "registration_updated",
}

export type EarlyBirdChangeNotice = {
  reason: "payment_due_passed" | "capacity_reached"
  previousAmountDue: number
  adultsMoved: number
  adultsKeptEarlyBird: number
}

type EmailContext = {
  pricing?: PricingConfig
  earlyBirdChange?: EarlyBirdChangeNotice
}

type AttendeeRow = {
  given_name?: string
  surname?: string
  age?: number
  needs_kids_supervision?: boolean
}

export type RegistrationEmailRecord = {
  id: string
  registration_no: string
  participant_reference?: string | null
  email: string
  given_name: string
  surname: string
  mobile?: string
  dietary_requirements?: string | null
  state?: string | null
  cfca_position?: string | null
  ministry?: string | null
  elder_assembly_attending?: boolean | null
  address_line1?: string
  address_line2?: string | null
  suburb?: string
  address_state?: string | null
  postcode?: string
  spouse_attending?: boolean
  spouse_surname?: string
  spouse_given_name?: string
  spouse_email?: string
  spouse_mobile?: string
  accommodation_type?: string | null
  pickup_melbourne_airport?: boolean | null
  dropoff_melbourne_airport?: boolean | null
  arrival_date?: string | null
  arrival_airport?: string
  arrival_flight_no?: string
  departure_date?: string | null
  departure_airport?: string
  departure_flight_no?: string
  hotel_name?: string
  hotel_address?: string
  accommodation_contact_name?: string
  accommodation_contact_phone?: string
  pickup_transport_contact_name?: string
  pickup_transport_contact_phone?: string
  dropoff_transport_contact_name?: string
  dropoff_transport_contact_phone?: string
  souvenir_orders?: { size?: string; quantity?: number }[] | null
  is_early_bird?: boolean | null
  early_bird_slot?: string | null
  early_bird_adult_limit?: number | null
  amount_due: number
  amount_paid: number
  payment_status: string
  attendees?: AttendeeRow[]
  registration_attendees?: AttendeeRow[]
}

type DetailEmailOptions = {
  introLines: string[]
  viewUrl?: string
  portalUrl?: string
  pricing?: PricingConfig
}

type EmailSection = {
  title: string
  rows: EmailRow[]
  link?: EmailLink
}

const uniqueCodeRow = (ref: string): EmailRow => ({
  label: "Unique Code",
  value: ref,
  emphasis: "code",
})

const paymentRef = (reg: RegistrationEmailRecord) =>
  reg.participant_reference || reg.registration_no

const supportLink = (topic: SupportTopic, reg: RegistrationEmailRecord): EmailLink => ({
  label: SUPPORT_CONTACTS[topic].linkLabel,
  href: buildSupportMailto(topic, {
    registrationNo: reg.registration_no,
    uniqueCode: reg.participant_reference,
    name: `${reg.given_name} ${reg.surname}`.trim(),
  }),
})

const supportHelpCard = (reg: RegistrationEmailRecord): EmailHelpCard => ({
  text: SUPPORT_HELP_TEXT,
  link: supportLink("general", reg),
})

const supportTextLine = (topic: SupportTopic) =>
  `${SUPPORT_CONTACTS[topic].linkLabel}: email ${SUPPORT_CONTACTS[topic].email}`

const helpTextLines = () => [`Need help? ${SUPPORT_HELP_TEXT}`, supportTextLine("general")]

/** Early bird reminders while early-bird adults on the registration are unpaid and the due date has not passed. */
const earlyBirdRemindersFor = (
  reg: RegistrationEmailRecord,
  pricing?: PricingConfig
): EmailReminders | undefined =>
  pricing && showsEarlyBirdReminders(reg, pricing)
    ? { title: EARLY_BIRD_REMINDERS_TITLE, items: earlyBirdReminders(pricing) }
    : undefined

const earlyBirdReminderTextLines = (reminders?: EmailReminders) =>
  reminders
    ? [
        reminders.title.toUpperCase(),
        ...reminders.items.map((item) => `- ${item.label}: ${item.text}`),
        "",
      ]
    : []

const earlyBirdRemindersHtml = (reg: RegistrationEmailRecord, pricing?: PricingConfig) => {
  const reminders = earlyBirdRemindersFor(reg, pricing)
  return reminders ? remindersCalloutHtml(reminders) : ""
}

/** Status first; Balance due only when money is still owed. */
const buildPaymentRows = (reg: RegistrationEmailRecord): EmailSection["rows"] => {
  const balance = balanceDue(reg.amount_due, reg.amount_paid)
  return [
    { label: PAYMENT_LABELS.status, value: formatPaymentStatus(reg.payment_status) },
    { label: PAYMENT_LABELS.fee, value: formatCurrency(Number(reg.amount_due)) },
    { label: PAYMENT_LABELS.paid, value: formatCurrency(Number(reg.amount_paid)) },
    ...(balance > 0 ? [{ label: PAYMENT_LABELS.balanceDue, value: formatCurrency(balance) }] : []),
  ]
}

const paymentRowsToText = (rows: EmailSection["rows"]) =>
  rows.map((row) => `${row.label}: ${row.value}`)

const buildSubject = (type: EmailType, reg: RegistrationEmailRecord) => {
  const ref = paymentRef(reg)
  switch (type) {
    case "registration_submitted":
      return `2027 CFCA National Conference Registration Confirmed — ${ref}`
    case "registration_updated":
      return `2027 CFCA National Conference Registration Updated — ${ref}`
    case "accommodation_updated":
      return `2027 CFCA National Conference Transport/Accommodation Updated — ${ref}`
    case "payment_received":
      return `2027 CFCA National Conference Payment Received — ${ref}`
    case "payment_reminder":
      return `2027 CFCA National Conference Payment Reminder — ${ref}`
    case "early_bird_pricing_updated":
      return `2027 CFCA National Conference Registration Fee Updated (Early Bird) — ${ref}`
  }
}

const formatAttendees = (reg: RegistrationEmailRecord) => {
  const rows = reg.registration_attendees ?? reg.attendees ?? []
  if (rows.length === 0) return "None"
  return rows
    .map((a) => {
      const supervision = a.needs_kids_supervision ? " (kids supervision)" : ""
      return `- ${a.given_name ?? ""} ${a.surname ?? ""} (age ${a.age ?? 0})${supervision}`
    })
    .join("\n")
}

const hasText = (value?: string | null) => Boolean(value && value.trim())

const formatAddress = (reg: RegistrationEmailRecord) =>
  [reg.address_line1, reg.address_line2, reg.suburb, reg.address_state, reg.postcode]
    .filter(hasText)
    .join(", ") || "—"

const buildRegistrationContent = (
  reg: RegistrationEmailRecord,
  payUrl?: string,
  context: EmailContext = {}
): { detailsCard: EmailDetailsCard; sections: EmailSection[] } => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const transport = booleansToTransportOption(
    reg.pickup_melbourne_airport,
    reg.dropoff_melbourne_airport
  )
  const position = reg.cfca_position
    ? CFCA_POSITION_LABELS[reg.cfca_position as keyof typeof CFCA_POSITION_LABELS] ??
      reg.cfca_position
    : "—"
  const ministry = reg.ministry
    ? MINISTRY_LABELS[reg.ministry as keyof typeof MINISTRY_LABELS] ?? reg.ministry
    : "—"

  const infoRows: EmailRow[] = [
    { label: "Registration No", value: reg.registration_no },
    { label: "Name", value: name },
    { label: "Email", value: reg.email },
    { label: "Mobile", value: reg.mobile ?? "—" },
    { label: "Conference State", value: reg.state ?? "—" },
    { label: "Ministry", value: ministry },
    { label: "Ministry Role", value: position },
    ...(reg.elder_assembly_attending ? [{ label: "Elder's assembly", value: "Attending" }] : []),
    { label: "Address", value: formatAddress(reg) },
  ]

  infoRows.push({ label: "Spouse attending", value: reg.spouse_attending ? "Yes" : "No" })
  if (reg.spouse_attending) {
    infoRows.push(
      {
        label: "Spouse name",
        value: `${reg.spouse_given_name ?? ""} ${reg.spouse_surname ?? ""}`.trim() || "—",
      },
      { label: "Spouse email", value: reg.spouse_email || "—" },
      { label: "Spouse mobile", value: reg.spouse_mobile || "—" }
    )
  }
  if (reg.dietary_requirements !== undefined) {
    infoRows.push({
      label: "Dietary requirements",
      value: reg.dietary_requirements?.trim() || "None specified",
    })
  }

  const balance = balanceDue(reg.amount_due, reg.amount_paid)
  const statusKey = String(reg.payment_status ?? "").toLowerCase()
  const tone: EmailStatusTone =
    statusKey === "paid" || statusKey === "partial" || statusKey === "overpaid"
      ? statusKey
      : "pending"

  const detailsCard: EmailDetailsCard = {
    heading: "Registration details",
    subtitle:
      balance > 0
        ? "Review your registration and complete payment to confirm your attendance."
        : "Review your registration details.",
    status: {
      label: tone === "pending" ? "Payment pending" : formatPaymentStatus(statusKey),
      tone,
    },
    infoRows,
    uniqueCode: ref,
    uniqueCodeNote:
      balance > 0 ? "Paying by bank transfer? Include this code in both Message and Ref." : undefined,
    payment: {
      fee: formatCurrency(Number(reg.amount_due)),
      paid: formatCurrency(Number(reg.amount_paid)),
      ...(balance > 0
        ? {
            balance: formatCurrency(balance),
            helper: "Your registration is reserved. Complete payment to confirm your attendance.",
            earlyBirdReminders: earlyBirdRemindersFor(reg, context.pricing),
            note: BANK_TRANSFER_ENCOURAGEMENT,
            ctaLabel: payUrl ? `Pay ${formatCurrency(balance)} securely` : undefined,
            ctaUrl: payUrl,
            footnote: "Secure payment · Confirmation emailed after payment",
          }
        : {}),
      supportLink: supportLink("payment", reg),
    },
  }

  const sections: EmailSection[] = []

  sections.push({
    title: "Additional Attendees",
    rows: [{ label: "Attendees", value: formatAttendees(reg) }],
  })

  const transportRows: EmailSection["rows"] = [
    {
      label: "Accommodation",
      value: getAccommodationLabel(reg.accommodation_type) || "—",
    },
    { label: "Transport", value: getTransportOptionLabel(transport) },
  ]

  if (hasText(reg.hotel_name) || hasText(reg.hotel_address)) {
    transportRows.push(
      { label: "Hotel / accommodation name", value: reg.hotel_name || "—" },
      { label: "Hotel / accommodation address", value: reg.hotel_address || "—" }
    )
  }

  if (hasText(reg.accommodation_contact_name) || hasText(reg.accommodation_contact_phone)) {
    transportRows.push({
      label: "Accommodation contact",
      value: `${reg.accommodation_contact_name || "—"} (${reg.accommodation_contact_phone || "—"})`,
    })
  }

  if (reg.pickup_melbourne_airport) {
    transportRows.push(
      { label: "Arrival date", value: reg.arrival_date || "—" },
      { label: "Arrival airport", value: reg.arrival_airport || "—" },
      { label: "Arrival flight", value: reg.arrival_flight_no || "—" }
    )
    if (
      hasText(reg.pickup_transport_contact_name) ||
      hasText(reg.pickup_transport_contact_phone)
    ) {
      transportRows.push({
        label: "Pickup transport contact",
        value: `${reg.pickup_transport_contact_name || "—"} (${reg.pickup_transport_contact_phone || "—"})`,
      })
    }
  }

  if (reg.dropoff_melbourne_airport) {
    transportRows.push(
      { label: "Departure date", value: reg.departure_date || "—" },
      { label: "Departure airport", value: reg.departure_airport || "—" },
      { label: "Departure flight", value: reg.departure_flight_no || "—" }
    )
    if (
      hasText(reg.dropoff_transport_contact_name) ||
      hasText(reg.dropoff_transport_contact_phone)
    ) {
      transportRows.push({
        label: "Drop-off transport contact",
        value: `${reg.dropoff_transport_contact_name || "—"} (${reg.dropoff_transport_contact_phone || "—"})`,
      })
    }
  }

  sections.push({
    title: "Accommodation & Transport",
    rows: transportRows,
    link: supportLink("accommodation", reg),
  })

  if (hasSouvenirPreOrder(reg.souvenir_orders)) {
    sections.push({
      title: "Souvenir pre-order (Love In Action)",
      rows: [
        {
          label: "T-shirts",
          value: formatSouvenirOrdersSummary(reg.souvenir_orders),
        },
        {
          label: "Souvenir total",
          value: formatCurrency(souvenirTotalAmount(reg.souvenir_orders)),
        },
      ],
    })
  }

  return { detailsCard, sections }
}

const buildFullRegistrationDetails = (
  reg: RegistrationEmailRecord,
  options: DetailEmailOptions
) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const transport = booleansToTransportOption(
    reg.pickup_melbourne_airport,
    reg.dropoff_melbourne_airport
  )
  const position = reg.cfca_position
    ? CFCA_POSITION_LABELS[reg.cfca_position as keyof typeof CFCA_POSITION_LABELS] ??
      reg.cfca_position
    : "—"
  const ministry = reg.ministry
    ? MINISTRY_LABELS[reg.ministry as keyof typeof MINISTRY_LABELS] ?? reg.ministry
    : "—"

  const lines = [...options.introLines, ""]

  lines.push(
    "=== Registration ===",
    `Registration No: ${reg.registration_no}`,
    `Unique Code: ${ref}`,
    `Name: ${name}`,
    `Email: ${reg.email}`,
    `Mobile: ${reg.mobile ?? "—"}`,
    `Conference State: ${reg.state ?? "—"}`,
    `Ministry: ${ministry}`,
    `Ministry Role: ${position}`,
    `Elder's assembly: ${reg.elder_assembly_attending ? "Attending" : "Not attending"}`
  )

  lines.push(`Address: ${formatAddress(reg)}`)

  lines.push(
    "",
    "=== Spouse ===",
    `Spouse attending: ${reg.spouse_attending ? "Yes" : "No"}`
  )

  if (reg.spouse_attending) {
    lines.push(
      `Spouse name: ${`${reg.spouse_given_name ?? ""} ${reg.spouse_surname ?? ""}`.trim()}`,
      `Spouse email: ${reg.spouse_email || "—"}`,
      `Spouse mobile: ${reg.spouse_mobile || "—"}`
    )
  }

  lines.push("", "=== Additional Attendees ===", formatAttendees(reg))

  lines.push(
    "",
    "=== Accommodation & Transport ===",
    `Accommodation: ${getAccommodationLabel(reg.accommodation_type) || "—"}`,
    `Transport: ${getTransportOptionLabel(transport)}`
  )

  if (hasText(reg.hotel_name) || hasText(reg.hotel_address)) {
    lines.push(
      `Hotel / accommodation name: ${reg.hotel_name || "—"}`,
      `Hotel / accommodation address: ${reg.hotel_address || "—"}`
    )
  }

  if (hasText(reg.accommodation_contact_name) || hasText(reg.accommodation_contact_phone)) {
    lines.push(
      `Accommodation contact: ${reg.accommodation_contact_name || "—"} (${reg.accommodation_contact_phone || "—"})`
    )
  }

  if (reg.pickup_melbourne_airport) {
    lines.push(
      `Arrival date: ${reg.arrival_date || "—"}`,
      `Arrival airport: ${reg.arrival_airport || "—"}`,
      `Arrival flight: ${reg.arrival_flight_no || "—"}`
    )
    if (
      hasText(reg.pickup_transport_contact_name) ||
      hasText(reg.pickup_transport_contact_phone)
    ) {
      lines.push(
        `Pickup transport contact: ${reg.pickup_transport_contact_name || "—"} (${reg.pickup_transport_contact_phone || "—"})`
      )
    }
  }

  if (reg.dropoff_melbourne_airport) {
    lines.push(
      `Departure date: ${reg.departure_date || "—"}`,
      `Departure airport: ${reg.departure_airport || "—"}`,
      `Departure flight: ${reg.departure_flight_no || "—"}`
    )
    if (
      hasText(reg.dropoff_transport_contact_name) ||
      hasText(reg.dropoff_transport_contact_phone)
    ) {
      lines.push(
        `Drop-off transport contact: ${reg.dropoff_transport_contact_name || "—"} (${reg.dropoff_transport_contact_phone || "—"})`
      )
    }
  }

  lines.push(supportTextLine("accommodation"))

  if (hasSouvenirPreOrder(reg.souvenir_orders)) {
    lines.push(
      "",
      "=== Souvenir pre-order (Love In Action) ===",
      `T-shirts: ${formatSouvenirOrdersSummary(reg.souvenir_orders)}`,
      `Souvenir total: ${formatCurrency(souvenirTotalAmount(reg.souvenir_orders))}`
    )
  }

  lines.push(
    "",
    "=== Payment ===",
    ...paymentRowsToText(buildPaymentRows(reg)),
    supportTextLine("payment"),
    ""
  )
  if (balanceDue(reg.amount_due, reg.amount_paid) > 0) {
    lines.push(
      ...earlyBirdReminderTextLines(earlyBirdRemindersFor(reg, options.pricing)),
      `IMPORTANT: Include your Unique Code (${ref}) in both Message and Ref. when paying via your bank app.`,
      "",
      `Bank transfer recommended. ${BANK_TRANSFER_ENCOURAGEMENT}`,
      ""
    )
  }

  if (options.viewUrl) {
    lines.push(
      "View your registration details (no login required):",
      options.viewUrl,
      "",
      "To edit your registration later, create an account or log in on the registration portal.",
      ""
    )
  }

  if (options.portalUrl) {
    lines.push(
      "View your registration online (log in required):",
      options.portalUrl,
      "",
      "If you do not have an account yet, create one using the same email as this registration, then open the link again.",
      ""
    )
  }

  lines.push(
    ...helpTextLines(),
    "",
    "If you have already paid and receive this in error, please contact the registration team."
  )

  return lines.join("\n")
}

/** Why the fee changed, and which adults keep the early bird rate. */
const earlyBirdChangeParagraphs = (
  reg: RegistrationEmailRecord,
  change: EarlyBirdChangeNotice,
  pricing?: PricingConfig
) => {
  const earlyBirdRate = pricing ? `${formatCurrency(pricing.adultEarlyBird)} per adult` : "per adult"
  const regularRate = pricing ? `${formatCurrency(pricing.adultRegular)} per adult` : "per adult"
  const moved = change.adultsMoved
  const kept = change.adultsKeptEarlyBird
  const reason =
    change.reason === "payment_due_passed"
      ? `The early bird rate of ${earlyBirdRate} required full payment by ${
          pricing ? formatEarlyBirdDate(pricing.earlyBirdPaymentDueDate) : "the early bird payment due date"
        }. Payment for ${formatAdultCount(moved)} on your registration had not been received by then, so ${
          moved === 1 ? "that adult moves" : "those adults move"
        } to the regular rate of ${regularRate}.`
      : `Early bird places for ${
          earlyBirdPoolForState(reg.state) === "melbourne" ? "Victorian" : "interstate"
        } delegates have now been filled by paid registrations. Early bird pricing is only secured once payment is received, so ${formatAdultCount(moved)} on your registration not yet covered by payment ${
          moved === 1 ? "moves" : "move"
        } to the regular rate of ${regularRate}.`
  const keptText =
    kept > 0
      ? `${formatAdultCount(kept)} already covered by your payment ${kept === 1 ? "keeps" : "keep"} the early bird rate.`
      : undefined
  return keptText ? [reason, keptText] : [reason]
}

const earlyBirdChangeRows = (reg: RegistrationEmailRecord, change: EarlyBirdChangeNotice): EmailRow[] => {
  const balance = balanceDue(reg.amount_due, reg.amount_paid)
  return [
    { label: "Previous registration fee", value: formatCurrency(Number(change.previousAmountDue)) },
    { label: "New registration fee", value: formatCurrency(Number(reg.amount_due)) },
    { label: PAYMENT_LABELS.paid, value: formatCurrency(Number(reg.amount_paid)) },
    ...(balance > 0 ? [{ label: PAYMENT_LABELS.balanceDue, value: formatCurrency(balance) }] : []),
  ]
}

const buildBody = (
  type: EmailType,
  reg: RegistrationEmailRecord,
  links: { viewUrl?: string; portalUrl?: string },
  context: EmailContext = {}
) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const base = `Dear ${name},\n\n`

  switch (type) {
    case "registration_submitted":
      return buildFullRegistrationDetails(reg, {
        introLines: [
          `Dear ${name},`,
          "",
          "Thank you for registering for the 2027 CFCA National Conference. Here is a summary of your registration:",
        ],
        viewUrl: links.viewUrl,
        pricing: context.pricing,
      })
    case "registration_updated":
      return buildFullRegistrationDetails(reg, {
        introLines: [
          `Dear ${name},`,
          "",
          `Your registration (${ref}) has been updated. Please review the full details below.`,
        ],
        portalUrl: links.portalUrl,
        pricing: context.pricing,
      })
    case "accommodation_updated":
      return buildFullRegistrationDetails(reg, {
        introLines: [
          `Dear ${name},`,
          "",
          `Your transport and/or accommodation details (${ref}) have been updated. Please review the full details below.`,
        ],
        portalUrl: links.portalUrl,
        pricing: context.pricing,
      })
    case "early_bird_pricing_updated": {
      const change = context.earlyBirdChange
      const balance = balanceDue(reg.amount_due, reg.amount_paid)
      return [
        `Dear ${name},`,
        "",
        `The registration fee for ${ref} has been updated.`,
        "",
        ...(change ? [...earlyBirdChangeParagraphs(reg, change, context.pricing), ""] : []),
        "=== Fee update ===",
        ...(change
          ? paymentRowsToText(earlyBirdChangeRows(reg, change))
          : paymentRowsToText(buildPaymentRows(reg))),
        `Unique Code: ${ref}`,
        supportTextLine("payment"),
        "",
        ...(balance > 0
          ? [
              `IMPORTANT: Include your Unique Code (${ref}) in both Message and Ref. when paying via your bank app.`,
              "",
              `Bank transfer recommended. ${BANK_TRANSFER_ENCOURAGEMENT}`,
              "",
            ]
          : []),
        ...(links.portalUrl ? ["View your registration online (log in required):", links.portalUrl, ""] : []),
        ...helpTextLines(),
      ].join("\n")
    }
    case "payment_received":
      return `${base}We have received your payment for registration ${ref}.

${paymentRowsToText(buildPaymentRows(reg)).join("\n")}
${supportTextLine("payment")}

${helpTextLines().join("\n")}`
    case "payment_reminder":
      return `${base}This is a reminder that registration ${ref} has a balance due.

${PAYMENT_LABELS.balanceDue}: ${formatCurrency(balanceDue(reg.amount_due, reg.amount_paid))}

Please include ${ref} in your payment reference.

${earlyBirdReminderTextLines(earlyBirdRemindersFor(reg, context.pricing)).map((line) => `${line}\n`).join("")}Bank transfer recommended. ${BANK_TRANSFER_ENCOURAGEMENT}
${supportTextLine("payment")}

${helpTextLines().join("\n")}`
  }
}

const buildHtml = (
  type: EmailType,
  reg: RegistrationEmailRecord,
  links: { viewUrl?: string; portalUrl?: string; payUrl?: string; siteUrl: string },
  context: EmailContext = {}
) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const greeting = paragraphHtml(`Dear ${name},`)

  switch (type) {
    case "registration_submitted":
      return renderEmail({
        heading: "Registration confirmed",
        introHtml:
          greeting +
          paragraphHtml(
            "Thank you for registering for the 2027 CFCA National Conference. Here is a summary of your registration:"
          ),
        ...buildRegistrationContent(reg, links.payUrl, context),
        ctaLabel: links.viewUrl ? "View registration" : undefined,
        ctaUrl: links.viewUrl,
        footerNote:
          "If you have already paid and receive this in error, please contact the registration team.",
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    case "registration_updated":
      return renderEmail({
        heading: "Registration updated",
        introHtml:
          greeting +
          paragraphHtml(
            `Your registration (${ref}) has been updated. Please review the full details below.`
          ),
        ...buildRegistrationContent(reg, links.payUrl, context),
        ctaLabel: "Open my registration",
        ctaUrl: links.portalUrl,
        footerNote:
          "Log in is required. If you do not have an account yet, create one using the same email as this registration.",
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    case "accommodation_updated":
      return renderEmail({
        heading: "Transport / accommodation updated",
        introHtml:
          greeting +
          paragraphHtml(
            `Your transport and/or accommodation details (${ref}) have been updated. Please review the full details below.`
          ),
        ...buildRegistrationContent(reg, links.payUrl, context),
        ctaLabel: "Open my registration",
        ctaUrl: links.portalUrl,
        footerNote:
          "Log in is required. If you do not have an account yet, create one using the same email as this registration.",
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    case "payment_received":
      return renderEmail({
        heading: "Payment received",
        introHtml:
          greeting +
          paragraphHtml(`We have received your payment for registration ${ref}.`),
        sections: [
          {
            title: "Payment",
            rows: [...buildPaymentRows(reg), uniqueCodeRow(ref)],
            link: supportLink("payment", reg),
          },
        ],
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    case "payment_reminder":
      return renderEmail({
        heading: "Payment reminder",
        introHtml:
          greeting +
          paragraphHtml(
            `This is a reminder that registration ${ref} has a balance due.`
          ) +
          earlyBirdRemindersHtml(reg, context.pricing) +
          bankTransferNoticeHtml(BANK_TRANSFER_ENCOURAGEMENT),
        sections: [
          {
            title: "Payment",
            rows: [
              {
                label: PAYMENT_LABELS.balanceDue,
                value: formatCurrency(balanceDue(reg.amount_due, reg.amount_paid)),
              },
              uniqueCodeRow(ref),
              {
                label: "Bank reference",
                value: "Include your Unique Code in both Message and Ref.",
              },
            ],
            link: supportLink("payment", reg),
          },
        ],
        ctaLabel: "View my registration",
        ctaUrl: links.portalUrl,
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    case "early_bird_pricing_updated": {
      const change = context.earlyBirdChange
      const balance = balanceDue(reg.amount_due, reg.amount_paid)
      return renderEmail({
        heading: "Registration fee updated",
        introHtml:
          greeting +
          paragraphHtml(`The registration fee for ${ref} has been updated.`) +
          (change
            ? earlyBirdChangeParagraphs(reg, change, context.pricing)
                .map((text) => paragraphHtml(text))
                .join("")
            : "") +
          (balance > 0
            ? paragraphHtml(
                `Please pay the balance of ${formatCurrency(balance)}. Paying by bank transfer? Include your Unique Code in both Message and Ref.`
              ) + bankTransferNoticeHtml(BANK_TRANSFER_ENCOURAGEMENT)
            : ""),
        sections: [
          {
            title: "Fee update",
            rows: [
              ...(change ? earlyBirdChangeRows(reg, change) : buildPaymentRows(reg)),
              uniqueCodeRow(ref),
            ],
            link: supportLink("payment", reg),
          },
        ],
        ctaLabel: "Open my registration",
        ctaUrl: links.portalUrl,
        footerNote:
          "Log in is required. If you do not have an account yet, create one using the same email as this registration.",
        helpCard: supportHelpCard(reg),
        siteUrl: links.siteUrl,
      })
    }
  }
}

export type RegistrationEmailContent = {
  subject: string
  text: string
  html: string
  viewUrl?: string
  portalUrl: string
}

/** Builds subject, plain text and HTML for a registration email without sending or logging it. */
export const buildRegistrationEmail = (
  registration: RegistrationEmailRecord,
  type: EmailType,
  options: { siteUrl: string; viewToken?: string } & EmailContext
): RegistrationEmailContent => {
  const { siteUrl, viewToken, pricing, earlyBirdChange } = options
  const context: EmailContext = { pricing, earlyBirdChange }
  const viewUrl = viewToken ? `${siteUrl}/r/${encodeURIComponent(viewToken)}` : undefined
  const portalUrl = `${siteUrl}/my-registration`
  const payUrl = viewToken
    ? `${siteUrl}/register/pay?view=${encodeURIComponent(viewToken)}`
    : `${siteUrl}/payment`
  const html = buildHtml(type, registration, { viewUrl, portalUrl, payUrl, siteUrl }, context)
  assertEmailIncludesLogo(html)

  return {
    subject: buildSubject(type, registration),
    text: buildBody(type, registration, { viewUrl, portalUrl }, context),
    html,
    viewUrl,
    portalUrl,
  }
}

export const sendRegistrationEmail = async (
  registration: RegistrationEmailRecord,
  type: EmailType,
  options: { request: Request; viewToken?: string; earlyBirdChange?: EarlyBirdChangeNotice }
) => {
  const { notificationRecipientEmail: notificationRecipient, pricing } =
    await getRegistrationRuntimeSettings()
  const { subject, text, html, viewUrl, portalUrl } = buildRegistrationEmail(registration, type, {
    siteUrl: getRequestSiteUrl(options.request),
    viewToken: options.viewToken,
    pricing,
    earlyBirdChange: options.earlyBirdChange,
  })
  const logoAttachment = getEmailLogoAttachment()

  const result = await sendTransactionalEmail({
    to: registration.email,
    ...(notificationRecipient ? { bcc: notificationRecipient } : {}),
    subject,
    text,
    html,
    attachments: [logoAttachment],
  })

  if (result.skipped) {
    console.log(`[email] (dev) ${type} to ${registration.email}${notificationRecipient ? `; bcc ${notificationRecipient}` : ""}: ${subject}`)
    console.log(`[email] (dev) logo attached as cid:${logoAttachment.inlineContentId}`)
    if (viewUrl) console.log(`[email] (dev) view link: ${viewUrl}`)
    if (type === "registration_updated" || type === "accommodation_updated" || type === "early_bird_pricing_updated") {
      console.log(`[email] (dev) portal link: ${portalUrl}`)
    }
  }

  await logEmail(registration, type, registration.email, subject, result.id)
}

const logEmail = async (
  registration: RegistrationEmailRecord,
  type: EmailType,
  recipient: string,
  subject: string,
  resendId: string | null
) => {
  const admin = createAdminClient()
  await admin.from("email_log").insert({
    registration_id: registration.id,
    email_type: EMAIL_LOG_TYPE[type],
    recipient,
    subject,
    resend_id: resendId,
  })
}

export const sendPaymentReminder = sendRegistrationEmail
