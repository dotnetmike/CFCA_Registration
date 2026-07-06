export const protectedPaths = ["/register", "/my-registration", "/payment", "/dashboard"]

export const isProtectedPath = (pathname: string) =>
  protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

export const isPublicAuthPath = (pathname: string) =>
  pathname === "/login" || pathname === "/signup"
