export type SupportTopic = "general" | "accommodation" | "payment"

type SupportContact = {
  email: string
  subject: string
  linkLabel: string
}

export const SUPPORT_CONTACTS: Record<SupportTopic, SupportContact> = {
  general: {
    email: "support@cfcanatcon.com",
    subject: "Question about my registration",
    linkLabel: "Ask a question",
  },
  accommodation: {
    email: "accomodation@cfcanatcon.com",
    subject: "Accommodation / transport question",
    linkLabel: "Ask about accommodation or transport",
  },
  payment: {
    email: "payment@cfcanatcon.com",
    subject: "Conference payment question",
    linkLabel: "Ask about conference payment",
  },
}

export const SUPPORT_HELP_TEXT =
  "Ask the organising team about payment, accommodation, hotels or transportation."

export type SupportRegistrationRef = {
  registrationNo: string
  uniqueCode?: string | null
  name?: string
}

/** `mailto:` link that opens the user's email app with the support address and a subject naming their registration. */
export const buildSupportMailto = (topic: SupportTopic, registration: SupportRegistrationRef) => {
  const contact = SUPPORT_CONTACTS[topic]
  const uniqueCode = registration.uniqueCode?.trim()
  const reference = uniqueCode && uniqueCode !== registration.registrationNo
    ? `${registration.registrationNo} (${uniqueCode})`
    : registration.registrationNo
  const body = [
    "Hi CFCA National Conference team,",
    "",
    "",
    "",
    `Registration No: ${registration.registrationNo}`,
    ...(uniqueCode ? [`Unique Code: ${uniqueCode}`] : []),
    ...(registration.name?.trim() ? [`Name: ${registration.name.trim()}`] : []),
  ].join("\n")
  const params = `subject=${encodeURIComponent(`${contact.subject} — ${reference}`)}&body=${encodeURIComponent(body)}`
  return `mailto:${contact.email}?${params}`
}
