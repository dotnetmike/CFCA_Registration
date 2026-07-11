import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError, getBearerToken } from "@/lib/auth/api"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { registrationSchema, formatRegistrationSchemaError } from "@/lib/registrations/schema"
import {
  claimEarlyBirdSlot,
  computeAmountDue,
  generateRegistrationNo,
  getRegistrationWithAttendees,
  mapFormToDb,
} from "@/lib/registrations/service"
import { assignParticipantReferenceIfNeeded } from "@/lib/registrations/participant-reference"
import { createViewAndSignupTokens } from "@/lib/registrations/view-token"
import { checkPublicRegistrationRateLimit } from "@/lib/registrations/rate-limit"
import { sendRegistrationEmail } from "@/lib/email/send"
import { writeAuditLog } from "@/lib/audit/log"
import { pickRegistrationAuditSnapshot } from "@/lib/audit/registration"
import { getRequestMeta } from "@/lib/auth/session"
import { normalizeEmail } from "@/lib/utils"
import {
  EMAIL_IN_USE_MESSAGE,
  isRegistrationEmailAvailable,
} from "@/lib/registrations/email-unique"

const getAssignParticipantReference = (body: unknown) =>
  typeof body === "object" &&
  body !== null &&
  "assign_participant_reference" in body &&
  (body as { assign_participant_reference?: boolean }).assign_participant_reference === true

const insertAttendees = async (
  registrationId: string,
  attendees: { surname: string; given_name: string; age: number; needs_kids_supervision?: boolean }[]
) => {
  if (attendees.length === 0) return
  const admin = createAdminClient()
  await admin.from("registration_attendees").insert(
    attendees.map((a, i) => ({
      registration_id: registrationId,
      surname: a.surname,
      given_name: a.given_name,
      age: a.age,
      needs_kids_supervision: a.age < 12 ? (a.needs_kids_supervision ?? false) : false,
      sort_order: i,
    }))
  )
}

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

const handlePublicSubmit = async (request: NextRequest, body: unknown) => {
  const meta = getRequestMeta(request)
  const ip = meta.ip ?? "unknown"
  if (!checkPublicRegistrationRateLimit(ip)) {
    return jsonError("Too many registration attempts. Please try again later.", 429)
  }

  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) return jsonError(formatRegistrationSchemaError(parsed.error))
  if (!parsed.data.submit) {
    return jsonError("Guest registrations must be submitted in full. Please complete all steps and submit.")
  }

  const email = normalizeEmail(parsed.data.email)
  const emailCheck = await isRegistrationEmailAvailable(email)
  if (!emailCheck.available) {
    return NextResponse.json(
      { error: EMAIL_IN_USE_MESSAGE, code: "EMAIL_IN_USE" },
      { status: 409 }
    )
  }

  const admin = createAdminClient()

  let participantReference: string | null = null
  try {
    participantReference = await assignParticipantReferenceIfNeeded(
      null,
      true,
      parsed.data.state,
      parsed.data.surname
    )
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to assign participant reference")
  }

  const earlyBirdSlot = await claimEarlyBirdSlot(parsed.data.state)
  const amountDue = computeAmountDue(parsed.data, earlyBirdSlot)
  const registrationNo = await generateRegistrationNo()

  const dbData = mapFormToDb(
    { ...parsed.data, email },
    {
      registration_no: registrationNo,
      user_id: null,
      amount_due: amountDue,
      early_bird_slot: earlyBirdSlot,
      is_early_bird: earlyBirdSlot !== "none",
      submitted_at: new Date().toISOString(),
    }
  )

  const { data: registration, error } = await admin
    .from("registrations")
    .insert({
      ...dbData,
      participant_reference: participantReference,
    })
    .select()
    .single()

  if (error) return jsonError(error.message, 500)

  await insertAttendees(registration.id, parsed.data.attendees)

  const { viewToken, signupToken } = await createViewAndSignupTokens(registration.id)
  const full = await getRegistrationWithAttendees(registration.id)

  if (full) {
    await sendRegistrationEmail(full, "registration_submitted", { viewToken })
  }

  await writeAuditLog({
    userId: null,
    action: "registration.submit",
    updatedValue: pickRegistrationAuditSnapshot(full as Record<string, unknown>),
    metadata: { registration_id: registration.id, guest: true },
    request,
  })

  return NextResponse.json(
    {
      registration: full,
      viewToken,
      signupToken,
    },
    { status: 201 }
  )
}

const handleAuthenticatedPost = async (request: NextRequest, body: unknown) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const forbidden = requirePermission(auth, "registrations:write_own")
  if (forbidden) return forbidden

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

  const email = normalizeEmail(parsed.data.email)
  const emailCheck = await isRegistrationEmailAvailable(email, { allowUserId: auth.sub })
  if (!emailCheck.available) {
    return NextResponse.json(
      { error: EMAIL_IN_USE_MESSAGE, code: "EMAIL_IN_USE" },
      { status: 409 }
    )
  }

  let participantReference: string | null = null
  try {
    participantReference = await assignParticipantReferenceIfNeeded(
      null,
      assignParticipantReference || parsed.data.submit,
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
  const registrationNo = parsed.data.submit
    ? await generateRegistrationNo()
    : `DRAFT-${auth.sub.slice(0, 8)}`

  const dbData = mapFormToDb(
    { ...parsed.data, email },
    {
      registration_no: registrationNo,
      user_id: auth.sub,
      amount_due: amountDue,
      early_bird_slot: earlyBirdSlot,
      is_early_bird: earlyBirdSlot !== "none",
      submitted_at: parsed.data.submit ? new Date().toISOString() : null,
    }
  )

  const { data: registration, error } = await admin
    .from("registrations")
    .insert({
      ...dbData,
      ...(participantReference ? { participant_reference: participantReference } : {}),
    })
    .select()
    .single()

  if (error) return jsonError(error.message, 500)

  await insertAttendees(registration.id, parsed.data.attendees)

  let viewToken: string | undefined
  let signupToken: string | undefined
  if (parsed.data.submit) {
    const tokens = await createViewAndSignupTokens(registration.id)
    viewToken = tokens.viewToken
    signupToken = tokens.signupToken
  }

  const full = await getRegistrationWithAttendees(registration.id)

  if (parsed.data.submit && full) {
    await sendRegistrationEmail(full, "registration_submitted", { viewToken })
  }

  await writeAuditLog({
    userId: auth.sub,
    action: parsed.data.submit ? "registration.submit" : "registration.create",
    updatedValue: pickRegistrationAuditSnapshot(full as Record<string, unknown>),
    metadata: { registration_id: registration.id },
    request,
  })

  return NextResponse.json(
    {
      registration: full,
      ...(viewToken ? { viewToken, signupToken } : {}),
    },
    { status: 201 }
  )
}

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null)
  const bearer = getBearerToken(request)

  if (!bearer) {
    return handlePublicSubmit(request, body)
  }

  const user = await verifyAccessToken(bearer)
  if (!user) {
    return handlePublicSubmit(request, body)
  }

  return handleAuthenticatedPost(request, body)
}
