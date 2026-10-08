import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import {
  getRawRegistrationRuntimeSettings,
  updateRegistrationRuntimeSettings,
} from "@/lib/registration-settings"
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/calculate"
import { writeAuditLog } from "@/lib/audit/log"
import { parseRegistrationWorkflow } from "@/lib/registration-workflow"
import { ACCOUNT_NUMBER_PATTERN, BSB_PATTERN } from "@/lib/payments/bank-details"

const optionalDateSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.literal(""),
])

const settingsSchema = z
  .object({
    registrationOpen: z.boolean(),
    registrationStartDate: optionalDateSchema.optional().default(""),
    registrationEndDate: optionalDateSchema.optional().default(""),
    pricing: z.object({
      earlyBirdStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      earlyBirdEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      earlyBirdPaymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      adultEarlyBird: z.coerce.number().min(0),
      adultRegular: z.coerce.number().min(0),
      age12Plus: z.coerce.number().min(0),
      age2To12: z.coerce.number().min(0),
      earlyBirdInterstateLimit: z.coerce.number().min(0).default(200),
      earlyBirdVicLimit: z.coerce.number().min(0).default(250),
    }),
    paymentReminderDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(12),
    notificationRecipientEmail: z.union([z.string().email(), z.literal("")]),
    registrationWorkflow: z.enum(["v1", "v2"]).default("v1"),
    souvenirPreorderEnabled: z.boolean().default(false),
    bankDetails: z
      .object({
        accountName: z.string().trim().max(100, "Bank account name is too long"),
        bsb: z
          .string()
          .trim()
          .refine((value) => value === "" || BSB_PATTERN.test(value), "BSB must be 6 digits (e.g. 123-456)"),
        accountNumber: z
          .string()
          .transform((value) => value.replace(/\s/g, ""))
          .refine(
            (value) => value === "" || ACCOUNT_NUMBER_PATTERN.test(value),
            "Bank account number must be 4–10 digits"
          ),
      })
      .default({ accountName: "", bsb: "", accountNumber: "" }),
  })
  .superRefine((data, ctx) => {
    if (
      data.registrationStartDate &&
      data.registrationEndDate &&
      data.registrationStartDate > data.registrationEndDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationStartDate"],
        message: "Registration opening date must be before or equal to closing date",
      })
    }
    if (data.pricing.earlyBirdStart > data.pricing.earlyBirdEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricing", "earlyBirdStart"],
        message: "Early bird start date must be before or equal to end date",
      })
    }
    if (data.pricing.earlyBirdPaymentDueDate < data.pricing.earlyBirdStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pricing", "earlyBirdPaymentDueDate"],
        message: "Early bird payment due date must be on or after the start date",
      })
    }
  })

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "users:manage")
  if (forbidden) return forbidden

  const { rawRegistrationOpen, settings } = await getRawRegistrationRuntimeSettings()
  return NextResponse.json(
    {
      settings: {
        ...settings,
        registrationOpen: rawRegistrationOpen,
      },
    },
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
    const { settings: previous } = await getRawRegistrationRuntimeSettings()
    const nextWorkflow = parseRegistrationWorkflow(parsed.data.registrationWorkflow)

    const settings = await updateRegistrationRuntimeSettings(
      {
        ...parsed.data,
        registrationWorkflow: nextWorkflow,
        pricing: { ...parsed.data.pricing, ageFree: DEFAULT_PRICING_CONFIG.ageFree },
      },
      auth.sub
    )

    if (previous.registrationWorkflow !== settings.registrationWorkflow) {
      await writeAuditLog({
        userId: auth.sub,
        action: "settings.registration_workflow_changed",
        previousValue: { registrationWorkflow: previous.registrationWorkflow },
        updatedValue: { registrationWorkflow: settings.registrationWorkflow },
        request,
      })
    }

    if (previous.souvenirPreorderEnabled !== settings.souvenirPreorderEnabled) {
      await writeAuditLog({
        userId: auth.sub,
        action: "settings.souvenir_preorder_changed",
        previousValue: { souvenirPreorderEnabled: previous.souvenirPreorderEnabled },
        updatedValue: { souvenirPreorderEnabled: settings.souvenirPreorderEnabled },
        request,
      })
    }

    if (JSON.stringify(previous.bankDetails) !== JSON.stringify(settings.bankDetails)) {
      await writeAuditLog({
        userId: auth.sub,
        action: "settings.bank_details_changed",
        previousValue: { bankDetails: previous.bankDetails },
        updatedValue: { bankDetails: settings.bankDetails },
        request,
      })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Could not update registration settings",
      500
    )
  }
}
