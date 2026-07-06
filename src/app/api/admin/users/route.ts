import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { hashPassword } from "@/lib/auth/tokens"
import { normalizeEmail } from "@/lib/utils"
import { revokeAllSessions } from "@/lib/auth/session"

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const admin = createAdminClient()
  const { data: users, error } = await admin
    .from("users")
    .select("id, email, name, is_active, created_at, user_user_groups(user_groups(name))")
    .order("created_at", { ascending: false })

  if (error) return jsonError(error.message, 500)

  const mapped = (users ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    is_active: u.is_active,
    created_at: u.created_at,
    groups: ((u.user_user_groups as unknown as { user_groups: { name: string } | null }[]) ?? [])
      .map((g) => g.user_groups?.name)
      .filter((name): name is string => !!name),
  }))

  return NextResponse.json({ users: mapped })
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  groups: z.array(z.string()).min(1),
})

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid user data")

  const admin = createAdminClient()
  const email = normalizeEmail(parsed.data.email)

  const { data: existing } = await admin.from("users").select("id").eq("email", email).maybeSingle()
  if (existing) return jsonError("Email already exists", 409)

  const passwordHash = await hashPassword(parsed.data.password)

  const { data: user, error } = await admin
    .from("users")
    .insert({
      email,
      name: parsed.data.name,
      password_hash: passwordHash,
      is_active: true,
    })
    .select("id")
    .single()

  if (error) return jsonError(error.message, 500)

  const { data: groups } = await admin
    .from("user_groups")
    .select("id, name")
    .in("name", parsed.data.groups)

  if (groups && groups.length > 0) {
    await admin.from("user_user_groups").insert(
      groups.map((g) => ({ user_id: user.id, group_id: g.id }))
    )
  }

  return NextResponse.json({ id: user.id }, { status: 201 })
}

export const PATCH = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const { userId, password, groups, is_active } = body ?? {}

  if (!userId) return jsonError("userId required")

  const admin = createAdminClient()

  if (password) {
    const passwordHash = await hashPassword(password)
    await admin.from("users").update({ password_hash: passwordHash }).eq("id", userId)
    await revokeAllSessions(userId)
  }

  if (typeof is_active === "boolean") {
    await admin.from("users").update({ is_active }).eq("id", userId)
    if (!is_active) await revokeAllSessions(userId)
  }

  if (groups && Array.isArray(groups)) {
    await admin.from("user_user_groups").delete().eq("user_id", userId)
    const { data: groupRows } = await admin.from("user_groups").select("id, name").in("name", groups)
    if (groupRows) {
      await admin.from("user_user_groups").insert(
        groupRows.map((g) => ({ user_id: userId, group_id: g.id }))
      )
    }
  }

  return NextResponse.json({ success: true })
}
