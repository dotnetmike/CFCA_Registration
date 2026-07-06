import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/admin"

type EmailType =
  | "registration_submitted"
  | "registration_updated"
  | "accommodation_updated"
  | "payment_received"
  | "payment_reminder"

type RegistrationRecord = {
  id: string
  registration_no: string
  email: string
  given_name: string
  surname: string
  amount_due: number
  amount_paid: number
  payment_status: string
}

const getResend = () => {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

const getFrom = () =>
  process.env.EMAIL_FROM ?? "CFCA Registration <onboarding@resend.dev>"

const buildSubject = (type: EmailType, reg: RegistrationRecord) => {
  switch (type) {
    case "registration_submitted":
      return `CFCA Conference Registration Confirmed — ${reg.registration_no}`
    case "registration_updated":
      return `CFCA Registration Updated — ${reg.registration_no}`
    case "accommodation_updated":
      return `CFCA Transport/Accommodation Updated — ${reg.registration_no}`
    case "payment_received":
      return `Payment Received — ${reg.registration_no}`
    case "payment_reminder":
      return `Payment Reminder — ${reg.registration_no}`
  }
}

const buildBody = (type: EmailType, reg: RegistrationRecord) => {
  const name = `${reg.given_name} ${reg.surname}`.trim()
  const base = `Dear ${name},\n\n`

  switch (type) {
    case "registration_submitted":
      return `${base}Thank you for registering for the CFCA Conference.

Registration Number: ${reg.registration_no}
Amount Due: $${Number(reg.amount_due).toFixed(2)}

Please include your registration number (${reg.registration_no}) in your bank transfer payment reference.

If you have already paid and receive this in error, please contact the registration team.`
    case "registration_updated":
      return `${base}Your registration (${reg.registration_no}) has been updated. Please review your details on the registration portal.`
    case "accommodation_updated":
      return `${base}Your transport and accommodation details (${reg.registration_no}) have been updated.`
    case "payment_received":
      return `${base}We have received your payment for registration ${reg.registration_no}.

Amount Paid: $${Number(reg.amount_paid).toFixed(2)}
Status: ${reg.payment_status}`
    case "payment_reminder":
      return `${base}This is a reminder that payment is outstanding for registration ${reg.registration_no}.

Amount Due: $${Number(reg.amount_due).toFixed(2)}

Please include ${reg.registration_no} in your payment reference.`
  }
}

export const sendRegistrationEmail = async (
  registration: RegistrationRecord,
  type: EmailType
) => {
  const resend = getResend()
  const subject = buildSubject(type, registration)
  const body = buildBody(type, registration)

  if (!resend) {
    console.log(`[email] (dev) ${type} to ${registration.email}: ${subject}`)
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
  registration: RegistrationRecord,
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
