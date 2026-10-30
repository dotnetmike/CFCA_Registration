export const protectedPaths = ["/my-registration", "/payment", "/dashboard", "/account"]

export const isProtectedPath = (pathname: string) =>
  protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** Same-site path (with optional query) for post-login redirects; anything else falls back. */
export const safeRedirectPath = (value: string | null | undefined, fallback = "/my-registration") => {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback
  return value
}

export const isPublicAuthPath = (pathname: string) =>
  pathname === "/login" ||
  pathname === "/signup" ||
  pathname === "/forgot-password" ||
  pathname === "/reset-password" ||
  pathname === "/register" ||
  pathname.startsWith("/register/") ||
  pathname.startsWith("/r/")
