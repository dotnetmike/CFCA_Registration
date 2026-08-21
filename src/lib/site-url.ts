/**
 * Absolute public origin for links in emails and redirects.
 * Derived from the incoming request — not from env configuration.
 */
export const getRequestSiteUrl = (request: Request): string => {
  const forwardedHost = request.headers.get("x-forwarded-host")
  const hostHeader = request.headers.get("host")
  const host = (forwardedHost ?? hostHeader)?.split(",")[0]?.trim()

  if (!host) {
    throw new Error("Cannot determine site URL: missing Host header on request")
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]")
  const proto = forwardedProto || (isLocal ? "http" : "https")

  return `${proto}://${host}`.replace(/\/$/, "")
}

/** @deprecated Prefer getRequestSiteUrl(request) — kept as alias. */
export const getSiteUrl = getRequestSiteUrl
