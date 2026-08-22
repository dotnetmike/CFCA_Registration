import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import {
  getRegistrationRuntimeSettings,
  updateRegistrationRuntimeSettings,
} from "@/lib/registration-settings"

const settingsSchema = z
  .object({
    registrationOpen: z.boolean(),
    pricing: z.object({
      earlyBirdStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      earlyBirdEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      adultEarlyBird: z.coerce.number().min(0),
      adultRegular: z.coerce.number().min(0),
      age12Plus: z.coerce.number().min(0),
      age2To12: z.coerce.number().min(0),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.pricing.earlyBirdStart > data.pricing.earlyBirdEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricing", "earlyBirdStart"],
        message: "Early bird start date must be before or equal to end date",
      })
    }
  })

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const settings = await getRegistrationRuntimeSettings()
  return NextResponse.json(
    { settings },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export const PATCH = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid settings payload")
  }

  try {
    const settings = await updateRegistrationRuntimeSettings(parsed.data, auth.sub)
    return NextResponse.json({ settings })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update registration settings",
      500
    )
  }
}
