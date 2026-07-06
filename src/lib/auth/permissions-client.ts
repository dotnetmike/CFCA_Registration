import type { AuthUser } from "@/lib/auth/context"

export const isManager = (user: AuthUser) =>
  user.groups.some((g) =>
    ["admin", "registration_manager", "accommodation_manager"].includes(g)
  )

export const isAdmin = (user: AuthUser) => user.groups.includes("admin")
