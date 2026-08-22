import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency } from "@/lib/pricing/calculate"
import { CFCA_POSITION_LABELS } from "@/lib/registrations/schema"
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
import {
  paragraphHtml,
  renderEmail,
  getEmailLogoAttachment,
  assertEmailIncludesLogo,
} from "@/lib/email/template"

type EmailType =
  | "registration_submitted"
  | "registration_updated"
  | "accommodation_updated"
  | "payment_received"
  | "payment_reminder"

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
  state?: string | null
  cfca_position?: string | null
  address_line1?: string
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
}

type EmailSection = {
  title: string
  rows: { label: string; value: string }[]
}

const getResend = () => {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const getFrom = () =>
  process.env.EMAIL_FROM ?? "CFCA Registration <onboarding@resend.dev>"

const paymentRef = (reg: RegistrationEmailRecord) =>
  reg.participant_reference || reg.registration_no

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

const buildRegistrationSections = (reg: RegistrationEmailRecord): EmailSection[] => {
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

  const sections: EmailSection[] = [
    {
      title: "Registration",
      rows: [
        { label: "Registration No", value: reg.registration_no },
        { label: "Unique Code", value: ref },
        { label: "Name", value: name },
        { label: "Email", value: reg.email },
        { label: "Mobile", value: reg.mobile ?? "—" },
        { label: "Conference State", value: reg.state ?? "—" },
        { label: "CFCA Position", value: position },
      ],
    },
  ]

  if (reg.address_line1 || reg.suburb || reg.postcode) {
    sections[0].rows.push({
      label: "Address",
      value: [reg.address_line1, reg.suburb, reg.address_state, reg.postcode]
        .filter(Boolean)
        .join(", "),
    })
  }

  const spouseRows: EmailSection["rows"] = [
    { label: "Spouse attending", value: reg.spouse_attending ? "Yes" : "No" },
  ]
  if (reg.spouse_attending) {
    spouseRows.push(
      {
        label: "Spouse name",
        value: `${reg.spouse_given_name ?? ""} ${reg.spouse_surname ?? ""}`.trim() || "—",
      },
      { label: "Spouse email", value: reg.spouse_email || "—" },
      { label: "Spouse mobile", value: reg.spouse_mobile || "—" }
    )
  }
  sections.push({ title: "Spouse", rows: spouseRows })

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
      { label: "Accommodation name", value: reg.hotel_name || "—" },
      { label: "Accommodation address", value: reg.hotel_address || "—" }
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

  sections.push({ title: "Accommodation & Transport", rows: transportRows })

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

  sections.push({
    title: "Payment",
    rows: [
      { label: "Amount Due", value: formatCurrency(Number(reg.amount_due)) },
      { label: "Amount Paid", value: formatCurrency(Number(reg.amount_paid)) },
      { label: "Status", value: reg.payment_status },
      {
        label: "Bank reference",
        value: `Include Unique Code (${ref}) in Message and Ref.`,
      },
    ],
  })

  return sections
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

  const lines = [...options.introLines, ""]

  lines.push(
    "=== Registration ===",
    `Registration No: ${reg.registration_no}`,
    `Unique Code: ${ref}`,
    `Name: ${name}`,
    `Email: ${reg.email}`,
    `Mobile: ${reg.mobile ?? "—"}`,
    `Conference State: ${reg.state ?? "—"}`,
    `CFCA Position: ${position}`
  )

  if (reg.address_line1 || reg.suburb || reg.postcode) {
    lines.push(
      `Address: ${[reg.address_line1, reg.suburb, reg.address_state, reg.postcode]
        .filter(Boolean)
        .join(", ")}`
    )
  }

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
      `Accommodation name: ${reg.hotel_name || "—"}`,
      `Accommodation address: ${reg.hotel_address || "—"}`
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
    `Amount Due: ${formatCurrency(Number(reg.amount_due))}`,
    `Amount Paid: ${formatCurrency(Number(reg.amount_paid))}`,
    `Status: ${reg.payment_status}`,
    "",
    `IMPORTANT: Include your Unique Code (${ref}) in both Message and Ref. when paying via your bank app.`,
    ""
  )

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
    "If you have already paid and receive this in error, please contact the registration team."
  )

  return lines.join("\n")
}

const buildBody = (
  type: EmailType,
  reg: RegistrationEmailRecord,
  links: { viewUrl?: string; portalUrl?: string }
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
      })
    case "registration_updated":
      return buildFullRegistrationDetails(reg, {
        introLines: [
          `Dear ${name},`,
          "",
          `Your registration (${ref}) has been updated. Please review the full details below.`,
        ],
        portalUrl: links.portalUrl,
      })
    case "accommodation_updated":
      return buildFullRegistrationDetails(reg, {
        introLines: [
          `Dear ${name},`,
          "",
          `Your transport and/or accommodation details (${ref}) have been updated. Please review the full details below.`,
        ],
        portalUrl: links.portalUrl,
      })
    case "payment_received":
      return `${base}We have received your payment for registration ${ref}.

Amount Paid: ${formatCurrency(Number(reg.amount_paid))}
Status: ${reg.payment_status}`
    case "payment_reminder":
      return `${base}This is a reminder that payment is outstanding for registration ${ref}.

Amount Due: ${formatCurrency(Number(reg.amount_due))}

Please include ${ref} in your payment reference.`
  }
}

const buildHtml = (
  type: EmailType,
  reg: RegistrationEmailRecord,
  links: { viewUrl?: string; portalUrl?: string; siteUrl: string }
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
        sections: buildRegistrationSections(reg),
        ctaLabel: links.viewUrl ? "View registration" : undefined,
        ctaUrl: links.viewUrl,
        footerNote:
          "If you have already paid and receive this in error, please contact the registration team.",
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
        sections: buildRegistrationSections(reg),
        ctaLabel: "Open my registration",
        ctaUrl: links.portalUrl,
        footerNote:
          "Log in is required. If you do not have an account yet, create one using the same email as this registration.",
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
        sections: buildRegistrationSections(reg),
        ctaLabel: "Open my registration",
        ctaUrl: links.portalUrl,
        footerNote:
          "Log in is required. If you do not have an account yet, create one using the same email as this registration.",
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
            rows: [
              {
                label: "Amount Paid",
                value: formatCurrency(Number(reg.amount_paid)),
              },
              { label: "Status", value: reg.payment_status },
              { label: "Unique Code", value: ref },
            ],
          },
        ],
        siteUrl: links.siteUrl,
      })
    case "payment_reminder":
      return renderEmail({
        heading: "Payment reminder",
        introHtml:
          greeting +
          paragraphHtml(
            `This is a reminder that payment is outstanding for registration ${ref}.`
          ),
        sections: [
          {
            title: "Payment",
            rows: [
              {
                label: "Amount Due",
                value: formatCurrency(Number(reg.amount_due)),
              },
              {
                label: "Bank reference",
                value: `Please include ${ref} in your payment reference.`,
              },
            ],
          },
        ],
        ctaLabel: "View my registration",
        ctaUrl: links.portalUrl,
        siteUrl: links.siteUrl,
      })
  }
}

export const sendRegistrationEmail = async (
  registration: RegistrationEmailRecord,
  type: EmailType,
  options: { request: Request; viewToken?: string }
) => {
  const siteUrl = getRequestSiteUrl(options.request)
  const viewUrl = options.viewToken
    ? `${siteUrl}/r/${encodeURIComponent(options.viewToken)}`
    : undefined
  const portalUrl = `${siteUrl}/my-registration`

  const resend = getResend()
  const subject = buildSubject(type, registration)
  const text = buildBody(type, registration, { viewUrl, portalUrl })
  const html = buildHtml(type, registration, { viewUrl, portalUrl, siteUrl })
  assertEmailIncludesLogo(html)
  const logoAttachment = getEmailLogoAttachment()

  if (!resend) {
    console.log(`[email] (dev) ${type} to ${registration.email}: ${subject}`)
    console.log(`[email] (dev) logo attached as cid:${logoAttachment.inlineContentId}`)
    if (viewUrl) console.log(`[email] (dev) view link: ${viewUrl}`)
    if (type === "registration_updated" || type === "accommodation_updated") {
      console.log(`[email] (dev) portal link: ${portalUrl}`)
    }
    await logEmail(registration, type, registration.email, subject, null)
    return
  }

  const { data, error } = await resend.emails.send({
    from: getFrom(),
    to: registration.email,
    subject,
    text,
    html,
    attachments: [logoAttachment],
  })

  if (error) {
    console.error("[email] Send failed:", error)
  }

  await logEmail(registration, type, registration.email, subject, data?.id ?? null)
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
    email_type: type,
    recipient,
    subject,
    resend_id: resendId,
  })
}

export const sendPaymentReminder = sendRegistrationEmail
