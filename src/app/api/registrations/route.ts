import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { registrationSchema, formatRegistrationSchemaError } from "@/lib/registrations/schema"
import {
  claimEarlyBirdSlot,
  computeAmountDue,
  generateRegistrationNo,
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

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()

  if (auth.permissions.includes("registrations:read_all")) {
    const { data, error } = await admin
      .from("registrations")
      .select("*, registration_attendees(*)")
      .order("created_at", { ascending: false })

    if (error) return jsonError(error.message, 500)
    return NextResponse.json({ registrations: data })
  }

  const { data, error } = await admin
    .from("registrations")
    .select("*, registration_attendees(*)")
    .eq("user_id", auth.sub)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ registration: data })
}

export const POST = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "registrations:write_own")
  if (forbidden) return forbidden

  const body = await request.json().catch(() => null)
  const assignParticipantReference = getAssignParticipantReference(body)
  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) return jsonError(formatRegistrationSchemaError(parsed.error))

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("registrations")
    .select("id")
    .eq("user_id", auth.sub)
    .maybeSingle()

  if (existing) return jsonError("Registration already exists. Use PUT to update.", 409)

  let participantReference: string | null = null
  try {
    participantReference = await assignParticipantReferenceIfNeeded(
      null,
      assignParticipantReference,
      parsed.data.state,
      parsed.data.surname
    )
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to assign participant reference")
  }

  const earlyBirdSlot = parsed.data.submit
    ? await claimEarlyBirdSlot(parsed.data.state)
    : ("none" as const)

  const amountDue = computeAmountDue(parsed.data, earlyBirdSlot)
  const registrationNo = parsed.data.submit ? await generateRegistrationNo() : `DRAFT-${auth.sub.slice(0, 8)}`

  const dbData = mapFormToDb(parsed.data, {
    registration_no: registrationNo,
    user_id: auth.sub,
    amount_due: amountDue,
    early_bird_slot: earlyBirdSlot,
    is_early_bird: earlyBirdSlot !== "none",
    submitted_at: parsed.data.submit ? new Date().toISOString() : null,
  })

  const { data: registration, error } = await admin
    .from("registrations")
    .insert({
      ...dbData,
      ...(participantReference ? { participant_reference: participantReference } : {}),
    })
    .select()
    .single()

  if (error) return jsonError(error.message, 500)

  if (parsed.data.attendees.length > 0) {
    await admin.from("registration_attendees").insert(
      parsed.data.attendees.map((a, i) => ({
        registration_id: registration.id,
        surname: a.surname,
        given_name: a.given_name,
        age: a.age,
        needs_kids_supervision: a.age < 12 ? (a.needs_kids_supervision ?? false) : false,
        sort_order: i,
      }))
    )
  }

  const full = await getRegistrationWithAttendees(registration.id)

  if (parsed.data.submit && full) {
    await sendRegistrationEmail(full, "registration_submitted")
  }

  return NextResponse.json({ registration: full }, { status: 201 })
}
