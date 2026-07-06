import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeEmail } from "@/lib/utils"
import { hashPassword, verifyPassword } from "@/lib/auth/tokens"
import { createSession, getRequestMeta } from "@/lib/auth/session"
import { applySessionCookies } from "@/lib/auth/cookies"
import { jsonError } from "@/lib/auth/api"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) return jsonError("Invalid credentials")

  const email = normalizeEmail(parsed.data.email)
  const admin = createAdminClient()

  const { data: user } = await admin
    .from("users")
    .select("id, password_hash, is_active")
    .eq("email", email)
    .maybeSingle()

  if (!user || !user.is_active) return jsonError("Invalid credentials", 401)

  const valid = await verifyPassword(parsed.data.password, user.password_hash)
  if (!valid) return jsonError("Invalid credentials", 401)

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
