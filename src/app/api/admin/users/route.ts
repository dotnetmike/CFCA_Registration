import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { hashPassword } from "@/lib/auth/tokens"
import { normalizeEmail } from "@/lib/utils"
import { revokeAllSessions } from "@/lib/auth/session"
import { writeAuditLog } from "@/lib/audit/log"
import { USER_GROUP_NAMES, type UserGroupName } from "@/lib/auth/user-groups"

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

const groupNameSchema = z.enum(
  USER_GROUP_NAMES as [UserGroupName, ...UserGroupName[]]
)

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  groups: z.array(groupNameSchema).min(1),
})

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8).optional(),
  is_active: z.boolean().optional(),
  groups: z.array(groupNameSchema).min(1).optional(),
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

  await writeAuditLog({
    userId: auth.sub,
    action: "user.create",
    updatedValue: { email, name: parsed.data.name, groups: parsed.data.groups },
    metadata: { target_user_id: user.id },
    request,
  })

  return NextResponse.json({ id: user.id }, { status: 201 })
}

export const PATCH = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid user update data")

  const { userId, password, groups, is_active } = parsed.data
  const admin = createAdminClient()

  const { data: existingUser } = await admin
    .from("users")
    .select("id, email, name, is_active, user_user_groups(user_groups(name))")
    .eq("id", userId)
    .maybeSingle()

  if (!existingUser) return jsonError("User not found", 404)

  const previousValue = {
    email: existingUser.email,
    name: existingUser.name,
    is_active: existingUser.is_active,
    groups: ((existingUser.user_user_groups as unknown as { user_groups: { name: string } | null }[]) ?? [])
      .map((g) => g.user_groups?.name)
      .filter((name): name is string => !!name),
  }

  const updatedValue: Record<string, unknown> = { ...previousValue }
  let shouldRevokeSessions = false

  if (password) {
    const passwordHash = await hashPassword(password)
    await admin.from("users").update({ password_hash: passwordHash }).eq("id", userId)
    shouldRevokeSessions = true
    updatedValue.password_changed = true
  }

  if (typeof is_active === "boolean") {
    await admin.from("users").update({ is_active }).eq("id", userId)
    if (!is_active) shouldRevokeSessions = true
    updatedValue.is_active = is_active
  }

  if (groups) {
    await admin.from("user_user_groups").delete().eq("user_id", userId)
    const { data: groupRows } = await admin.from("user_groups").select("id, name").in("name", groups)
    if (groupRows && groupRows.length > 0) {
      await admin.from("user_user_groups").insert(
        groupRows.map((g) => ({ user_id: userId, group_id: g.id }))
      )
    }
    updatedValue.groups = groups
    shouldRevokeSessions = true
  }

  if (shouldRevokeSessions) {
    await revokeAllSessions(userId)
  }

  await writeAuditLog({
    userId: auth.sub,
    action: "user.update",
    previousValue,
    updatedValue,
    metadata: { target_user_id: userId },
    request,
  })

  return NextResponse.json({ success: true })
}
