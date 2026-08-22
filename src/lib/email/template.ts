import { readFileSync } from "fs"
import { join } from "path"

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

type EmailSection = {
  title: string
  rows: { label: string; value: string }[]
}

type RenderEmailOptions = {
  heading: string
  introHtml: string
  sections?: EmailSection[]
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
  /** Public origin for footer home link (from request Host). */
  siteUrl?: string
}

const brand = {
  deep: "#0D47A1",
  mid: "#1565C0",
  pale: "#BBDEFB",
  mist: "#F5F9FC",
  ink: "#0B1F33",
  grey: "#757575",
  line: "#D6E4F5",
  white: "#FFFFFF",
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
  sections = [],
  ctaLabel,
  ctaUrl,
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
              <td style="padding:6px 0;width:38%;vertical-align:top;font-size:13px;color:${brand.grey};">${escapeHtml(row.label)}</td>
              <td style="padding:6px 0;vertical-align:top;font-size:14px;color:${brand.ink};font-weight:600;">${escapeHtml(row.value)}</td>
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
              ${sectionsHtml}
              ${ctaHtml}
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
