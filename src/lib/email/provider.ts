import { Resend } from "resend"

export type EmailProviderId = "resend" | "office365"

export type EmailInlineAttachment = {
  filename: string
  content: Buffer
  contentType: string
  inlineContentId: string
}

export type SendEmailParams = {
  to: string
  subject: string
  text: string
  html: string
  bcc?: string
  attachments?: EmailInlineAttachment[]
}

export type SendEmailResult = {
  id: string | null
  skipped: boolean
}

const normalizeEnv = (value: string | undefined) => {
  if (!value) return ""
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export const getEmailProviderId = (): EmailProviderId => {
  const raw = normalizeEnv(process.env.EMAIL_PROVIDER).toLowerCase()
  if (raw === "office365" || raw === "o365" || raw === "microsoft") {
    return "office365"
  }
  return "resend"
}

export const getResendFrom = () =>
  normalizeEnv(process.env.EMAIL_FROM) ||
  "CFCA Registration <onboarding@resend.dev>"

const getResendClient = () => {
  const key = normalizeEnv(process.env.RESEND_API_KEY)
  if (!key) return null
  return new Resend(key)
}

type Office365GraphConfig = {
  tenantId: string
  clientId: string
  clientSecret: string
  mailbox: string
  fromName: string
}

const getOffice365GraphConfig = (): Office365GraphConfig | null => {
  const tenantId =
    normalizeEnv(process.env.OFFICE365_TENANT_ID) ||
    normalizeEnv(process.env.AZURE_TENANT_ID)
  const clientId =
    normalizeEnv(process.env.OFFICE365_CLIENT_ID) ||
    normalizeEnv(process.env.AZURE_CLIENT_ID)
  const clientSecret =
    normalizeEnv(process.env.OFFICE365_CLIENT_SECRET) ||
    normalizeEnv(process.env.AZURE_CLIENT_SECRET)
  const mailbox =
    normalizeEnv(process.env.OFFICE365_USERNAME) ||
    normalizeEnv(process.env.OFFICE365_EMAIL)
  const fromName =
    normalizeEnv(process.env.OFFICE365_FROM_NAME) || "CFCA Registration"

  if (!tenantId || !clientId || !clientSecret || !mailbox) return null

  return { tenantId, clientId, clientSecret, mailbox, fromName }
}

type CachedToken = {
  accessToken: string
  expiresAtMs: number
}

let graphTokenCache: CachedToken | null = null

const getGraphAccessToken = async (config: Office365GraphConfig) => {
  const now = Date.now()
  if (graphTokenCache && graphTokenCache.expiresAtMs > now + 60_000) {
    return graphTokenCache.accessToken
  }

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  })

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        `Failed to acquire Microsoft Graph token (HTTP ${res.status})`
    )
  }

  const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 3600
  graphTokenCache = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  }

  return data.access_token
}

/** Prefer Entra displayName when readable; otherwise OFFICE365_FROM_NAME / default. */
const resolveOffice365FromName = async (
  config: Office365GraphConfig,
  accessToken: string
) => {
  const configured = normalizeEnv(process.env.OFFICE365_FROM_NAME)
  if (configured) return configured

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailbox)}?$select=displayName`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (res.ok) {
      const data = (await res.json()) as { displayName?: string }
      const displayName = data.displayName?.trim()
      if (displayName) return displayName
    }
  } catch {
    // Fall through to configured/default name
  }

  return config.fromName
}

const encodeRfc2047 = (value: string) => {
  if (/^[\x20-\x7E]*$/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

const formatMailboxHeader = (name: string, email: string) => {
  const safeName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `${encodeRfc2047(safeName)} <${email}>`
}

/** Build MIME so From display name is honored (JSON sendMail often ignores `from.name`). */
const buildMimeMessage = (
  params: SendEmailParams,
  fromName: string,
  fromEmail: string
) => {
  const altBoundary = `cfca_alt_${Date.now().toString(36)}`
  const relatedBoundary = `cfca_related_${Date.now().toString(36)}`
  const hasInline = !!params.attachments?.length

  const headers = [
    `From: ${formatMailboxHeader(fromName, fromEmail)}`,
    `To: ${params.to}`,
    ...(params.bcc ? [`Bcc: ${params.bcc}`] : []),
    `Subject: ${encodeRfc2047(params.subject)}`,
    "MIME-Version: 1.0",
  ]

  const textPart = [
    `--${altBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    params.text,
  ].join("\r\n")

  const htmlPart = [
    `--${altBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    params.html,
  ].join("\r\n")

  const alternative = [textPart, htmlPart, `--${altBoundary}--`].join("\r\n")

  if (!hasInline) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      alternative,
      "",
    ].join("\r\n")
  }

  const inlineParts = (params.attachments ?? []).map((attachment) => {
    const cid = attachment.inlineContentId.replace(/^<|>$/g, "")
    return [
      `--${relatedBoundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${cid}>`,
      `Content-Disposition: inline; filename="${attachment.filename}"`,
      "",
      attachment.content.toString("base64").replace(/(.{76})/g, "$1\r\n"),
    ].join("\r\n")
  })

  const related = [
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    alternative,
    "",
    ...inlineParts,
    `--${relatedBoundary}--`,
  ].join("\r\n")

  return [
    ...headers,
    `Content-Type: multipart/related; boundary="${relatedBoundary}"; type="multipart/alternative"`,
    "",
    related,
    "",
  ].join("\r\n")
}

const sendViaResend = async (params: SendEmailParams): Promise<SendEmailResult> => {
  const resend = getResendClient()
  if (!resend) {
    console.log(
      `[email] (dev) provider=resend skipped — missing RESEND_API_KEY; to=${params.to}; subject=${params.subject}`
    )
    return { id: null, skipped: true }
  }

  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    ...(params.bcc ? { bcc: params.bcc } : {}),
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  })

  if (error) {
    console.error("[email] Resend send failed:", error)
    return { id: null, skipped: false }
  }

  return { id: data?.id ?? null, skipped: false }
}

const sendViaOffice365 = async (params: SendEmailParams): Promise<SendEmailResult> => {
  const config = getOffice365GraphConfig()
  if (!config) {
    console.log(
      `[email] (dev) provider=office365 skipped — missing OFFICE365_TENANT_ID / OFFICE365_CLIENT_ID / OFFICE365_CLIENT_SECRET / OFFICE365_USERNAME; to=${params.to}; subject=${params.subject}`
    )
    return { id: null, skipped: true }
  }

  try {
    const accessToken = await getGraphAccessToken(config)
    const fromName = await resolveOffice365FromName(config, accessToken)
    const mime = buildMimeMessage(params, fromName, config.mailbox)
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mailbox)}/sendMail`

    const res = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
      },
      // Graph requires the MIME payload as a base64 string
      body: Buffer.from(mime, "utf8").toString("base64"),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => "")
      console.error(
        `[email] Office 365 Graph send failed: HTTP ${res.status}`,
        errBody || res.statusText
      )
      return { id: null, skipped: false }
    }

    return { id: `graph:${config.mailbox}:${Date.now()}`, skipped: false }
  } catch (error) {
    console.error("[email] Office 365 Graph send failed:", error)
    return { id: null, skipped: false }
  }
}

/** Send a transactional email using the configured provider (`EMAIL_PROVIDER`). */
export const sendTransactionalEmail = async (
  params: SendEmailParams
): Promise<SendEmailResult> => {
  const provider = getEmailProviderId()

  if (provider === "office365") {
    return sendViaOffice365(params)
  }

  return sendViaResend(params)
}
