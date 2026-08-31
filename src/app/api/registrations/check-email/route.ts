import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jsonError, getBearerToken } from "@/lib/auth/api"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { normalizeEmail } from "@/lib/utils"
import {
  getEmailInUseMessage,
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

  const token = getBearerToken(request)
  const auth = token ? await verifyAccessToken(token) : null

  try {
    const result = await isRegistrationEmailAvailable(
      normalizeEmail(parsed.data.email),
      { excludeRegistrationId: parsed.data.excludeId, allowUserId: auth?.sub ?? null }
    )

    if (!result.available) {
      return NextResponse.json({
        available: false,
        error: getEmailInUseMessage(result.reason),
        reason: result.reason,
      })
    }

    return NextResponse.json({ available: true })
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Unable to verify email availability",
      500
    )
  }
}
