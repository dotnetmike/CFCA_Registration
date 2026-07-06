import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { registrationSchema, REGISTRATION_FIELDS, formatRegistrationSchemaError } from "@/lib/registrations/schema"
import {
  claimEarlyBirdSlot,
  computeAmountDue,
  getRegistrationWithAttendees,
  mapFormToDb,
} from "@/lib/registrations/service"
import { assignParticipantReferenceIfNeeded } from "@/lib/registrations/participant-reference"
import { sendRegistrationEmail } from "@/lib/email/send"

const getAssignParticipantReference = (body: unknown) =>
  typeof body === "object" &&
  body !== null &&
  "assign_participant_reference" in body &&
  (body as { assign_participant_reference?: boolean }).assign_participant_reference === true

type RouteParams = { params: Promise<{ id: string }> }

const filterFieldsByRole = (
  data: Record<string, unknown>,
  permissions: string[]
): Record<string, unknown> => {
  const isAdmin = permissions.includes("registrations:write_all") &&
    permissions.includes("accommodation:write_all")
  if (permissions.includes("users:manage") || isAdmin) return data

  const filtered: Record<string, unknown> = {}

  if (permissions.includes("registrations:write_all")) {
    for (const key of REGISTRATION_FIELDS.registration) {
      if (key in data) filtered[key] = data[key]
    }
  }

  if (permissions.includes("accommodation:write_all")) {
    for (const key of REGISTRATION_FIELDS.accommodation) {
      if (key in data) filtered[key] = data[key]
    }
  }

  if (permissions.includes("registrations:write_own")) {
    return data
  }

  return filtered
}

export const GET = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const registration = await getRegistrationWithAttendees(id)
  if (!registration) return jsonError("Not found", 404)

  const canReadAll = auth.permissions.includes("registrations:read_all")
  if (!canReadAll && registration.user_id !== auth.sub) {
    return jsonError("Forbidden", 403)
  }

  return NextResponse.json({ registration })
}

export const PUT = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!existing) return jsonError("Not found", 404)

  const isOwner = existing.user_id === auth.sub
  const canWriteAll = auth.permissions.includes("registrations:write_all")
  const canWriteOwn = auth.permissions.includes("registrations:write_own") && isOwner
  const canWriteAccom = auth.permissions.includes("accommodation:write_all")

  if (!canWriteAll && !canWriteOwn && !canWriteAccom) {
    return jsonError("Forbidden", 403)
  }

  const body = await request.json().catch(() => null)
  const assignParticipantReference = getAssignParticipantReference(body)
  const parsed = registrationSchema.partial().safeParse(body)
  if (!parsed.success) return jsonError(formatRegistrationSchemaError(parsed.error))

  let participantReference = existing.participant_reference as string | null
  try {
    participantReference = await assignParticipantReferenceIfNeeded(
      participantReference,
      assignParticipantReference,
      parsed.data.state ?? existing.state,
      parsed.data.surname ?? existing.surname
    )
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to assign participant reference")
  }

  let updateData = filterFieldsByRole(
    parsed.data as Record<string, unknown>,
    auth.permissions
  ) as Partial<typeof parsed.data>

  if (isOwner && !canWriteAll && !canWriteAccom) {
    updateData = parsed.data
  }

  const merged = { ...existing, ...updateData }
  const earlyBirdSlot = existing.is_early_bird
    ? (existing.early_bird_slot as "interstate" | "melbourne" | "none")
    : parsed.data.submit && parsed.data.state
      ? await claimEarlyBirdSlot(parsed.data.state ?? existing.state)
      : ("none" as const)

  const formData = {
    ...merged,
    attendees: parsed.data.attendees ?? [],
    submit: parsed.data.submit ?? false,
  }

  const amountDue = computeAmountDue(
    formData as Parameters<typeof computeAmountDue>[0],
    earlyBirdSlot
  )

  const wasSubmitted = !!existing.submitted_at
  const isSubmitting = parsed.data.submit && !wasSubmitted

  const dbUpdate = mapFormToDb(formData as Parameters<typeof mapFormToDb>[0], {
    user_id: existing.user_id,
    amount_due: amountDue,
    early_bird_slot: earlyBirdSlot,
    is_early_bird: earlyBirdSlot !== "none",
    submitted_at: isSubmitting ? new Date().toISOString() : existing.submitted_at,
    registration_no: existing.registration_no,
  })

  const { error } = await admin
    .from("registrations")
    .update({
      ...dbUpdate,
      ...(participantReference ? { participant_reference: participantReference } : {}),
    })
    .eq("id", id)
  if (error) return jsonError(error.message, 500)

  if (parsed.data.attendees) {
    await admin.from("registration_attendees").delete().eq("registration_id", id)
    if (parsed.data.attendees.length > 0) {
      await admin.from("registration_attendees").insert(
        parsed.data.attendees.map((a, i) => ({
          registration_id: id,
          surname: a.surname,
          given_name: a.given_name,
          age: a.age,
          needs_kids_supervision: a.age < 12 ? (a.needs_kids_supervision ?? false) : false,
          sort_order: i,
        }))
      )
    }
  }

  const full = await getRegistrationWithAttendees(id)
  if (full) {
    const emailType = isSubmitting
      ? "registration_submitted"
      : canWriteAccom && !canWriteAll
        ? "accommodation_updated"
        : "registration_updated"
    await sendRegistrationEmail(full, emailType)
  }

  return NextResponse.json({ registration: full })
}
