import { readFileSync } from "fs"
import { join } from "path"

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export type EmailRow = {
  label: string
  value: string
  /** "code" renders the value as a large highlighted chip (e.g. Unique Code payment reference). */
  emphasis?: "code"
}

export type EmailLink = {
  label: string
  href: string
}

export type EmailHelpCard = {
  text: string
  link: EmailLink
}

type EmailSection = {
  title: string
  rows: EmailRow[]
  /** Support link shown under the section rows (e.g. accommodation `mailto:`). */
  link?: EmailLink
}

export type EmailStatusTone = "pending" | "partial" | "paid" | "overpaid"

export type EmailDetailsCard = {
  heading: string
  subtitle: string
  status: { label: string; tone: EmailStatusTone }
  infoRows: EmailRow[]
  uniqueCode: string
  uniqueCodeNote?: string
  payment: {
    fee: string
    paid: string
    balance?: string
    helper?: string
    /** Bank transfer encouragement shown above the pay button. */
    note?: string
    ctaLabel?: string
    ctaUrl?: string
    footnote?: string
    /** Payment support link (`mailto:`) shown at the bottom of the payment summary. */
    supportLink?: EmailLink
  }
}

type RenderEmailOptions = {
  heading: string
  introHtml: string
  /** "Registration details" card (info, Unique Code, payment summary) shown before sections. */
  detailsCard?: EmailDetailsCard
  sections?: EmailSection[]
  ctaLabel?: string
  ctaUrl?: string
  /** "Need help?" box shown after the main call to action. */
  helpCard?: EmailHelpCard
  footerNote?: string
  /** Public origin for footer home link (from request Host). */
  siteUrl?: string
}

const brand = {
  deep: "#173F7A",
  mid: "#1E5AA8",
  pale: "#C7D7EE",
  mist: "#F6F8FB",
  ink: "#172033",
  grey: "#64748B",
  line: "#E2E8F0",
  white: "#FFFFFF",
  codeText: "#173F7A",
  codeBg: "#F2F6FC",
  codeBorder: "#C7D7EE",
}

export const uniqueCodeHtml = (code: string) =>
  `<span style="display:inline-block;padding:6px 14px;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:0.04em;color:${brand.codeText};background:${brand.codeBg};border:2px solid ${brand.codeBorder};border-radius:6px;word-break:break-all;">${escapeHtml(code)}</span>`

const rowValueHtml = (row: EmailRow) =>
  row.emphasis === "code" ? uniqueCodeHtml(row.value) : escapeHtml(row.value)

const STATUS_TONES: Record<EmailStatusTone, { bg: string; text: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E" },
  partial: { bg: "#E0F2FE", text: "#075985" },
  paid: { bg: "#DCFCE7", text: "#166534" },
  overpaid: { bg: "#EDE9FE", text: "#5B21B6" },
}

/** Green "Bank transfer recommended" callout. */
export const bankTransferNoticeHtml = (text: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;"><tr><td style="padding:12px 14px;border-radius:8px;background:#ECFDF5;border:1px solid #A7F3D0;font-size:14px;line-height:1.5;color:#065F46;"><strong>Bank transfer recommended.</strong> ${escapeHtml(text)}</td></tr></table>`

/** Envelope (U+2709) forced to text presentation so clients do not swap in a colour emoji. */
const ENVELOPE_HTML = "&#9993;&#65038;"

/** Inline `mailto:` support link with an envelope icon before the underlined label. */
export const emailSupportLinkHtml = (link: EmailLink) =>
  `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;"><a href="${escapeHtml(link.href)}" style="color:${brand.mid};font-weight:600;text-decoration:none;"><span aria-hidden="true" style="text-decoration:none;">${ENVELOPE_HTML}</span>&nbsp;<span style="text-decoration:underline;">${escapeHtml(link.label)}</span></a></p>`

const renderHelpCard = (card: EmailHelpCard) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${brand.line};border-radius:12px;background:${brand.white};">
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0;font-size:16px;font-weight:700;color:${brand.ink};">Need help?</p>
              <p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${brand.grey};">${escapeHtml(card.text)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 0;">
                <tr>
                  <td align="center" style="border:1px solid ${brand.mid};border-radius:8px;background:${brand.white};">
                    <a href="${escapeHtml(card.link.href)}" style="display:block;padding:11px 16px;font-size:14px;font-weight:700;color:${brand.mid};text-decoration:none;"><span aria-hidden="true">${ENVELOPE_HTML}</span>&nbsp;${escapeHtml(card.link.label)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`

const sectionLabelHtml = (text: string) =>
  `<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${brand.grey};">${escapeHtml(text)}</p>`

const renderDetailsCard = (card: EmailDetailsCard) => {
  const tone = STATUS_TONES[card.status.tone]
  const infoRows = card.infoRows
    .map(
      (row) => `
        <tr>
          <td style="padding:6px 12px 6px 0;width:40%;vertical-align:top;font-size:13px;color:${brand.grey};">${escapeHtml(row.label)}</td>
          <td style="padding:6px 0;vertical-align:top;font-size:15px;color:${brand.ink};">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join("")

  const amountRow = (label: string, value: string) => `
        <tr>
          <td style="padding:4px 0;font-size:14px;color:${brand.grey};">${escapeHtml(label)}</td>
          <td align="right" style="padding:4px 0;font-size:15px;font-weight:600;color:${brand.ink};">${escapeHtml(value)}</td>
        </tr>`

  const { payment } = card
  const balanceHtml = payment.balance
    ? `
        <tr><td colspan="2" style="padding:12px 0 0;border-top:1px solid ${brand.line};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td colspan="2" style="padding:0;font-size:17px;font-weight:700;color:${brand.ink};">Balance due</td></tr>
        <tr><td colspan="2" style="padding:2px 0 0;font-size:32px;line-height:1.2;font-weight:700;color:${brand.ink};">${escapeHtml(payment.balance)}</td></tr>`
    : ""
  const helperHtml = payment.helper
    ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:${brand.grey};">${escapeHtml(payment.helper)}</p>`
    : ""
  const noteHtml = payment.note ? bankTransferNoticeHtml(payment.note) : ""
  const ctaHtml =
    payment.ctaLabel && payment.ctaUrl
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
          <tr>
            <td align="center" style="border-radius:8px;background:${brand.mid};">
              <a href="${escapeHtml(payment.ctaUrl)}" style="display:block;padding:14px 16px;font-size:15px;font-weight:700;color:${brand.white};text-decoration:none;">${escapeHtml(payment.ctaLabel)}</a>
            </td>
          </tr>
        </table>`
      : ""
  const footnoteHtml = payment.footnote
    ? `<p style="margin:14px 0 0;font-size:12px;color:${brand.grey};">${escapeHtml(payment.footnote)}</p>`
    : ""
  const paymentSupportHtml = payment.supportLink ? emailSupportLinkHtml(payment.supportLink) : ""
  const codeNoteHtml = card.uniqueCodeNote
    ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:${brand.grey};">${escapeHtml(card.uniqueCodeNote)}</p>`
    : ""

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${brand.line};border-radius:12px;background:${brand.white};">
          <tr>
            <td style="padding:20px 20px 16px;border-bottom:1px solid ${brand.line};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:top;">
                    <h2 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:${brand.ink};">${escapeHtml(card.heading)}</h2>
                    <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${brand.grey};">${escapeHtml(card.subtitle)}</p>
                  </td>
                  <td align="right" style="vertical-align:top;padding-left:12px;white-space:nowrap;">
                    <span style="display:inline-block;padding:5px 12px;border-radius:999px;font-size:13px;font-weight:700;background:${tone.bg};color:${tone.text};">${escapeHtml(card.status.label)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px;">
              ${sectionLabelHtml("Registration information")}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${infoRows}</table>
              <div style="margin:16px 0;border-top:1px solid ${brand.line};font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:0 0 8px;font-size:13px;color:${brand.grey};">Unique Code</p>
              ${uniqueCodeHtml(card.uniqueCode)}
              ${codeNoteHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 20px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;background:${brand.codeBg};border:1px solid ${brand.line};">
                <tr>
                  <td style="padding:20px;">
                    ${sectionLabelHtml("Payment summary")}
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${amountRow("Registration fee", payment.fee)}
                      ${amountRow("Amount paid", payment.paid)}
                      ${balanceHtml}
                    </table>
                    ${helperHtml}
                    ${noteHtml}
                    ${ctaHtml}
                    ${footnoteHtml}
                    ${paymentSupportHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`
}

/** Inline CID used by Resend attachments so the logo renders without a public URL. */
export const EMAIL_LOGO_CID = "cfca-logo"

export const getEmailLogoSrc = () => `cid:${EMAIL_LOGO_CID}`

export const getEmailLogoAttachment = () => {
  const filePath = join(process.cwd(), "public", "brand", "cfca-logo-official.jpg")
  const content = readFileSync(filePath)
  return {
    filename: "cfca-logo-official.jpg",
    content,
    contentType: "image/jpeg",
    inlineContentId: EMAIL_LOGO_CID,
  }
}

export const renderEmail = ({
  heading,
  introHtml,
  detailsCard,
  sections = [],
  ctaLabel,
  ctaUrl,
  helpCard,
  footerNote,
  siteUrl,
}: RenderEmailOptions) => {
  const logoSrc = getEmailLogoSrc()

  const sectionsHtml = sections
    .map((section) => {
      const rows = section.rows
        .map(
          (row) => `
            <tr>
              <td style="padding:6px 0;width:38%;vertical-align:${row.emphasis === "code" ? "middle" : "top"};font-size:13px;color:${brand.grey};">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;vertical-align:top;font-size:14px;color:${brand.ink};font-weight:600;">${rowValueHtml(row)}</td>
            </tr>`
        )
        .join("")

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid ${brand.line};border-radius:10px;background:${brand.white};">
          <tr>
            <td style="padding:14px 16px 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${brand.deep};border-bottom:1px solid ${brand.line};">
              ${escapeHtml(section.title)}
            </td>
          </tr>
          <tr>
            <td style="padding:10px 16px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
              ${section.link ? emailSupportLinkHtml(section.link) : ""}
            </td>
          </tr>
        </table>`
    })
    .join("")

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
          <tr>
            <td style="border-radius:8px;background:${brand.deep};">
              <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:${brand.white};text-decoration:none;">
                ${escapeHtml(ctaLabel)}
              </a>
            </td>
          </tr>
        </table>`
      : ""

  const footer = footerNote
    ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${brand.grey};">${escapeHtml(footerNote)}</p>`
    : ""

  const homeLink = siteUrl
    ? `<p style="margin:0;font-size:12px;">
                <a href="${escapeHtml(siteUrl)}" style="color:${brand.deep};text-decoration:none;">${escapeHtml(siteUrl.replace(/^https?:\/\//, ""))}</a>
              </p>`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.mist};font-family:Arial,Helvetica,sans-serif;color:${brand.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.mist};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:${brand.white};border-radius:14px;overflow:hidden;border:1px solid ${brand.line};">
          <tr>
            <td style="background:${brand.white};padding:20px 24px 12px;border-bottom:1px solid ${brand.line};">
              <img src="${escapeHtml(logoSrc)}" alt="Couples for Christ Australia" width="280" style="display:block;max-width:280px;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="height:5px;background:${brand.deep};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${brand.deep};">${escapeHtml(heading)}</h1>
              <div style="font-size:15px;line-height:1.6;color:${brand.ink};">${introHtml}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 8px;">
              ${detailsCard ? renderDetailsCard(detailsCard) : ""}
              ${sectionsHtml}
              ${ctaHtml}
              ${helpCard ? renderHelpCard(helpCard) : ""}
              ${footer}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 24px;border-top:1px solid ${brand.line};">
              <p style="margin:0 0 4px;font-size:12px;color:${brand.grey};">Couples for Christ Australia — Conference Registration</p>
              ${homeLink}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export const assertEmailIncludesLogo = (html: string) => {
  if (!html.includes(`cid:${EMAIL_LOGO_CID}`) && !html.includes("/brand/cfca-logo-official.jpg")) {
    throw new Error("Email HTML is missing the CFCA logo image")
  }
}

export const paragraphHtml = (text: string) =>
  `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`

export const paragraphsHtml = (lines: string[]) =>
  lines
    .filter((line) => line.trim().length > 0)
    .map((line) => paragraphHtml(line))
    .join("")
