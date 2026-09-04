import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { sendRegistrationEmail } from "@/lib/email/send"
import type { RegistrationEmailRecord } from "@/lib/email/send"
import { getRegistrationWithAttendees } from "@/lib/registrations/service"
import { refreshViewToken } from "@/lib/registrations/view-token"
import { writeAuditLog } from "@/lib/audit/log"

type RouteParams = { params: Promise<{ id: string }> }

type ResendEmailType =
  | "registration_submitted"
  | "registration_updated"
  | "accommodation_updated"

const bodySchema = z.object({
  type: z
    .enum(["registration_submitted", "registration_updated", "accommodation_updated"])
    .optional(),
})

const resolveResendEmailType = (
  permissions: string[],
  submittedAt: string | null | undefined,
  requested?: ResendEmailType
): ResendEmailType | null => {
  if (requested) return requested

  const canWriteAll = permissions.includes("registrations:write_all")
  const canWriteAccom = permissions.includes("accommodation:write_all")

  if (submittedAt && canWriteAll) return "registration_submitted"
  if (canWriteAll) return "registration_updated"
  if (canWriteAccom) return "accommodation_updated"
  return null
}

export const POST = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const readForbidden = requirePermission(auth, "registrations:read_all")
  if (readForbidden) return readForbidden

  const canWriteAll = auth.permissions.includes("registrations:write_all")
  const canWriteAccom = auth.permissions.includes("accommodation:write_all")
  if (!canWriteAll && !canWriteAccom) {
    return jsonError("Forbidden", 403)
  }

  const { id } = await params
  const registration = await getRegistrationWithAttendees(id)
  if (!registration) return jsonError("Not found", 404)

  let requestedType: ResendEmailType | undefined
  try {
    const raw = await request.json().catch(() => ({}))
    const parsed = bodySchema.parse(raw)
    requestedType = parsed.type
  } catch {
    return jsonError("Invalid request body", 400)
  }

  const emailType = resolveResendEmailType(
    auth.permissions,
    registration.submitted_at as string | null | undefined,
    requestedType
  )

  if (!emailType) {
    return jsonError("You do not have permission to resend this email type", 403)
  }

  if (emailType === "registration_submitted" && !canWriteAll) {
    return jsonError("Only registration managers can resend confirmation emails", 403)
  }

  if (emailType === "registration_updated" && !canWriteAll) {
    return jsonError("Only registration managers can resend full update emails", 403)
  }

  let viewToken: string | undefined
  if (emailType === "registration_submitted") {
    viewToken = await refreshViewToken(id)
  }

  await sendRegistrationEmail(
    registration as RegistrationEmailRecord,
    emailType,
    {
      request,
      ...(viewToken ? { viewToken } : {}),
    }
  )

  await writeAuditLog({
    userId: auth.sub,
    action: "registration.email_resend",
    updatedValue: {
      registration_id: id,
      email_type: emailType,
      recipient: registration.email,
    },
    metadata: { registration_id: id },
    request,
  })

  return NextResponse.json({
    ok: true,
    email_type: emailType,
    recipient: registration.email,
  })
}
