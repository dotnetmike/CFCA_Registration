import { createServerClient } from "@/lib/supabase/admin"
import type { AccessTokenPayload } from "./tokens"

export type AuthUser = {
  id: string
  email: string
  name: string
  is_active: boolean
  groups: string[]
  permissions: string[]
}

export const getUserAuthData = async (userId: string): Promise<AuthUser | null> => {
  const admin = createServerClient()

  const { data: user, error } = await admin
    .from("users")
    .select("id, email, name, is_active")
    .eq("id", userId)
    .maybeSingle()

  if (error || !user || !user.is_active) return null

  const { data: groupRows } = await admin
    .from("user_user_groups")
    .select("user_groups(name)")
    .eq("user_id", userId)

  const groups = (groupRows ?? [])
    .map((r) => (r.user_groups as unknown as { name: string } | null)?.name)
    .filter((g): g is string => !!g)

  let permissions: string[] = []
  if (groups.length > 0) {
    const { data: groupIds } = await admin
      .from("user_groups")
      .select("id")
      .in("name", groups)

    const ids = (groupIds ?? []).map((g) => g.id)
    if (ids.length > 0) {
      const { data: permRows } = await admin
        .from("user_group_permissions")
        .select("permissions(key)")
        .in("group_id", ids)

      permissions = [
        ...new Set(
          (permRows ?? [])
            .map((r) => (r.permissions as unknown as { key: string } | null)?.key)
            .filter((p): p is string => !!p)
        ),
      ]
    }
  }

  return { ...user, groups, permissions }
}

export const buildAccessPayload = (user: AuthUser): AccessTokenPayload => ({
  sub: user.id,
  email: user.email,
  name: user.name,
  permissions: user.permissions,
  groups: user.groups,
})

export const hasPermission = (user: AccessTokenPayload, permission: string) =>
  user.permissions.includes(permission)

export const isManager = (user: AccessTokenPayload) =>
  user.groups.some((g) =>
    ["admin", "registration_manager", "accommodation_manager"].includes(g)
  )
