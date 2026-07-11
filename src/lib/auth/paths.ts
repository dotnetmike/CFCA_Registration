export const protectedPaths = ["/my-registration", "/payment", "/dashboard", "/account"]

export const isProtectedPath = (pathname: string) =>
  protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

export const isPublicAuthPath = (pathname: string) =>
  pathname === "/login" ||
  pathname === "/signup" ||
  pathname === "/forgot-password" ||
  pathname === "/reset-password" ||
  pathname === "/register" ||
  pathname.startsWith("/register/") ||
  pathname.startsWith("/r/")
