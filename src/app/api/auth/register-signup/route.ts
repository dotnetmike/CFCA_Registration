import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { jsonError } from "@/lib/auth/api"
import { hashPassword } from "@/lib/auth/tokens"
import { createSession, getRequestMeta } from "@/lib/auth/session"
import { applySessionCookies } from "@/lib/auth/cookies"
import { normalizeEmail } from "@/lib/utils"
import {
  getRegistrationBySignupToken,
  linkRegistrationToUser,
} from "@/lib/registrations/view-token"
import { writeAuditLog } from "@/lib/audit/log"

const schema = z.object({
  signupToken: z.string().min(1),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
})

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid signup data")

  const registration = await getRegistrationBySignupToken(parsed.data.signupToken)
  if (!registration) return jsonError("Invalid or expired signup link", 400)
  if (registration.user_id) return jsonError("This registration is already linked to an account", 409)

  const email = normalizeEmail(registration.email)
  const admin = createAdminClient()

  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existingUser) {
    return jsonError(
      "An account with this email already exists. Please log in to manage your registration.",
      409
    )
  }

  const name =
    parsed.data.name?.trim() ||
    `${registration.given_name} ${registration.surname}`.trim() ||
    email

  const passwordHash = await hashPassword(parsed.data.password)

  const { data: user, error: userError } = await admin
    .from("users")
    .insert({
      email,
      password_hash: passwordHash,
      name,
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
    await linkRegistrationToUser(registration.id, user.id)
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to link registration", 500)
  }

  const { accessToken, refreshToken, user: authUser } = await createSession(
    user.id,
    getRequestMeta(request)
  )

  await writeAuditLog({
    userId: user.id,
    action: "auth.register_signup",
    updatedValue: { email, name, registration_id: registration.id },
    request,
  })

  const response = NextResponse.json({
    accessToken,
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      groups: authUser.groups,
      permissions: authUser.permissions,
    },
    registrationId: registration.id,
  })

  applySessionCookies(response, accessToken, refreshToken)
  return response
}
