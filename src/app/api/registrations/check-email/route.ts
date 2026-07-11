import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jsonError } from "@/lib/auth/api"
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

  const result = await isRegistrationEmailAvailable(
    normalizeEmail(parsed.data.email),
    { excludeRegistrationId: parsed.data.excludeId }
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
