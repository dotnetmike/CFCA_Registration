import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeEmail } from "@/lib/utils"
import { hashPassword } from "@/lib/auth/tokens"
import { createSession, getRequestMeta } from "@/lib/auth/session"
import { applySessionCookies, clearSessionCookies } from "@/lib/auth/cookies"
import { jsonError } from "@/lib/auth/api"
import { createDraftRegistrationForUser } from "@/lib/registrations/create-draft"

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
})

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid signup data")

  const email = normalizeEmail(parsed.data.email)
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existing) return jsonError("Email already registered", 409)

  const passwordHash = await hashPassword(parsed.data.password)

  const { data: user, error: userError } = await admin
    .from("users")
    .insert({
      email,
      password_hash: passwordHash,
      name: parsed.data.name,
      is_active: true,
    })
    .select("id")
    .single()

  if (userError) return jsonError(userError.message, 500)

  const { data: participantGroup } = await admin
    .from("user_groups")
    .select("id")
    .eq("name", "participant")
    .single()

  if (participantGroup) {
    await admin.from("user_user_groups").insert({
      user_id: user.id,
      group_id: participantGroup.id,
    })
  }

  try {
    await createDraftRegistrationForUser(user.id, email, parsed.data.name)
  } catch (err) {
    console.error("[signup] Failed to create draft registration:", err)
  }

  const { accessToken, refreshToken, user: authUser } = await createSession(
    user.id,
    getRequestMeta(request)
  )

  const response = NextResponse.json({
    accessToken,
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      groups: authUser.groups,
      permissions: authUser.permissions,
    },
  })

  applySessionCookies(response, accessToken, refreshToken)

  return response
}
