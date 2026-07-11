import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatCurrency } from "@/lib/pricing/calculate"
import { CFCA_POSITION_LABELS } from "@/lib/registrations/schema"
import {
  booleansToTransportOption,
  getAccommodationLabel,
  getTransportOptionLabel,
} from "@/lib/registrations/transport"
import { getSiteUrl } from "@/lib/site-url"

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
  amount_due: number
  amount_paid: number
  payment_status: string
  attendees?: AttendeeRow[]
  registration_attendees?: AttendeeRow[]
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
      return `CFCA Conference Registration Confirmed — ${ref}`
    case "registration_updated":
      return `CFCA Registration Updated — ${ref}`
    case "accommodation_updated":
      return `CFCA Transport/Accommodation Updated — ${ref}`
    case "payment_received":
      return `Payment Received — ${ref}`
    case "payment_reminder":
      return `Payment Reminder — ${ref}`
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

const buildSubmittedDetails = (reg: RegistrationEmailRecord, viewUrl?: string) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const transport = booleansToTransportOption(
    reg.pickup_melbourne_airport,
    reg.dropoff_melbourne_airport
  )
  const position = reg.cfca_position
    ? CFCA_POSITION_LABELS[reg.cfca_position as keyof typeof CFCA_POSITION_LABELS] ?? reg.cfca_position
    : "—"

  const lines = [
    `Dear ${name},`,
    "",
    "Thank you for registering for the CFCA Conference. Here is a summary of your registration:",
    "",
    "=== Registration ===",
    `Registration No: ${reg.registration_no}`,
    `Payment Reference (Unique Code): ${ref}`,
    `Name: ${name}`,
    `Email: ${reg.email}`,
    `Mobile: ${reg.mobile ?? "—"}`,
    `Conference State: ${reg.state ?? "—"}`,
    `CFCA Position: ${position}`,
  ]

  if (reg.address_line1 || reg.suburb || reg.postcode) {
    lines.push(
      `Address: ${[reg.address_line1, reg.suburb, reg.address_state, reg.postcode].filter(Boolean).join(", ")}`
    )
  }

  lines.push(
    "",
    "=== Spouse ===",
    `Spouse attending: ${reg.spouse_attending ? "Yes" : "No"}`
  )

  if (reg.spouse_attending) {
    lines.push(
      `Spouse name: ${reg.spouse_given_name ?? ""} ${reg.spouse_surname ?? ""}`.trim(),
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

  if (reg.pickup_melbourne_airport) {
    lines.push(
      `Arrival date: ${reg.arrival_date || "—"}`,
      `Arrival airport: ${reg.arrival_airport || "—"}`,
      `Arrival flight: ${reg.arrival_flight_no || "—"}`
    )
  }

  if (reg.dropoff_melbourne_airport) {
    lines.push(
      `Departure date: ${reg.departure_date || "—"}`,
      `Departure airport: ${reg.departure_airport || "—"}`,
      `Departure flight: ${reg.departure_flight_no || "—"}`
    )
  }

  lines.push(
    "",
    "=== Payment ===",
    `Amount Due: ${formatCurrency(Number(reg.amount_due))}`,
    `Status: ${reg.payment_status}`,
    "",
    `IMPORTANT: Include your Unique Code (${ref}) in both Message and Ref. when paying via your bank app.`,
    ""
  )

  if (viewUrl) {
    lines.push(
      "View your registration details (no login required):",
      viewUrl,
      "",
      "To edit your registration later, create an account or log in on the registration portal.",
      ""
    )
  }

  lines.push("If you have already paid and receive this in error, please contact the registration team.")

  return lines.join("\n")
}

const buildBody = (type: EmailType, reg: RegistrationEmailRecord, viewUrl?: string) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const ref = paymentRef(reg)
  const base = `Dear ${name},\n\n`

  switch (type) {
    case "registration_submitted":
      return buildSubmittedDetails(reg, viewUrl)
    case "registration_updated":
      return `${base}Your registration (${ref}) has been updated. Please review your details on the registration portal.`
    case "accommodation_updated":
      return `${base}Your transport and accommodation details (${ref}) have been updated.`
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

export const sendRegistrationEmail = async (
  registration: RegistrationEmailRecord,
  type: EmailType,
  options?: { viewToken?: string }
) => {
  const viewUrl = options?.viewToken
    ? `${getSiteUrl()}/r/${encodeURIComponent(options.viewToken)}`
    : undefined

  const resend = getResend()
  const subject = buildSubject(type, registration)
  const body = buildBody(type, registration, viewUrl)

  if (!resend) {
    console.log(`[email] (dev) ${type} to ${registration.email}: ${subject}`)
    if (viewUrl) console.log(`[email] (dev) view link: ${viewUrl}`)
    await logEmail(registration, type, registration.email, subject, null)
    return
  }

  const { data, error } = await resend.emails.send({
    from: getFrom(),
    to: registration.email,
    subject,
    text: body,
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
