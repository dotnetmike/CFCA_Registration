import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jsonError, getBearerToken } from "@/lib/auth/api"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { normalizeEmail } from "@/lib/utils"
import {
  EMAIL_IN_USE_MESSAGE,
  isRegistrationEmailAvailable,
} from "@/lib/registrations/email-unique"

const querySchema = z.object({
  email: z.string().email(),
  excludeId: z.string().uuid().optional(),
})

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    email: searchParams.get("email") ?? "",
    excludeId: searchParams.get("excludeId") || undefined,
  })

  if (!parsed.success) return jsonError("Valid email required")

  // Allow the requester's own account email to pass when they're updating their own registration
  const token = getBearerToken(request)
  const auth = token ? await verifyAccessToken(token) : null

  const result = await isRegistrationEmailAvailable(
    normalizeEmail(parsed.data.email),
    { excludeRegistrationId: parsed.data.excludeId, allowUserId: auth?.sub ?? null }
  )

  if (!result.available) {
    return NextResponse.json({
      available: false,
      error: EMAIL_IN_USE_MESSAGE,
      reason: result.reason,
    })
  }

  return NextResponse.json({ available: true })
}
