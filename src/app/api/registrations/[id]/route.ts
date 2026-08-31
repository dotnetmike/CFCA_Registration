import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth, requirePermission, jsonError } from "@/lib/auth/api"
import { registrationSchema, registrationBaseSchema, REGISTRATION_FIELDS, formatRegistrationSchemaError } from "@/lib/registrations/schema"
import {
  claimEarlyBirdSlot,
  computeAmountDue,
  generateRegistrationNo,
  getRegistrationWithAttendees,
  mapFormToDb,
} from "@/lib/registrations/service"
import {
  hasRegistrationChanges,
  normalizeComparableAttendees,
  snapshotFromFormValues,
  snapshotFromRegistration,
} from "@/lib/registrations/compare"
import { assignParticipantReferenceIfNeeded } from "@/lib/registrations/participant-reference"
import { createViewAndSignupTokens } from "@/lib/registrations/view-token"
import { sendRegistrationEmail } from "@/lib/email/send"
import { writeAuditLog, pickChangedFields } from "@/lib/audit/log"
import { pickRegistrationAuditSnapshot, REGISTRATION_AUDIT_FIELDS } from "@/lib/audit/registration"
import { normalizeEmail } from "@/lib/utils"
import {
  getEmailInUseMessage,
  isRegistrationEmailAvailable,
} from "@/lib/registrations/email-unique"
import {
  canBypassRegistrationClosed,
  getRegistrationRuntimeSettings,
} from "@/lib/registration-settings"

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

  let paymentLastUpdatedByName: string | null = null
  if (canReadAll && registration.payment_last_updated_by) {
    const admin = createAdminClient()
    const { data: updater } = await admin
      .from("users")
      .select("name")
      .eq("id", registration.payment_last_updated_by)
      .maybeSingle()
    paymentLastUpdatedByName = updater?.name ?? null
  }

  return NextResponse.json({
    registration: {
      ...registration,
      payment_last_updated_by_name: paymentLastUpdatedByName,
    },
  })
}

export const PUT = async (request: NextRequest, { params }: RouteParams) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const runtime = await getRegistrationRuntimeSettings()
  if (!runtime.registrationOpen && !canBypassRegistrationClosed(auth)) {
    return jsonError(
      "Registration is currently closed. Please contact your Chapter Leader for assistance.",
      403
    )
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("registrations")
    .select("id, registration_no, user_id, surname, given_name, email, mobile, dietary_requirements, address_line1, address_line2, suburb, address_state, postcode, cfca_position, state, spouse_surname, spouse_given_name, spouse_attending, spouse_email, spouse_mobile, spouse_dietary_requirements, accommodation_type, pickup_melbourne_airport, dropoff_melbourne_airport, hotel_transport_required, arrival_date, arrival_airport, arrival_flight_no, departure_date, departure_airport, departure_flight_no, hotel_name, hotel_address, accommodation_contact_name, accommodation_contact_phone, pickup_transport_contact_name, pickup_transport_contact_phone, dropoff_transport_contact_name, dropoff_transport_contact_phone, payment_status, amount_due, amount_paid, payment_last_updated_source, payment_last_updated_at, payment_last_updated_by, souvenir_orders, is_early_bird, early_bird_slot, submitted_at, created_at, updated_at, participant_reference, view_token_hash")
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
  const parsed = registrationBaseSchema.partial().safeParse(body)
  if (!parsed.success) return jsonError(formatRegistrationSchemaError(parsed.error))

  if (parsed.data.submit) {
    const incomingAccommodation = parsed.data.accommodation_type as string | null | undefined
    const hasExistingAccommodation = !!existing.accommodation_type
    if (!incomingAccommodation && !hasExistingAccommodation) {
      return jsonError("Please select an accommodation option")
    }
    if (incomingAccommodation === "") {
      return jsonError("Please select an accommodation option")
    }

    const incomingTransport = parsed.data.transport_option as string | null | undefined
    const hasExistingTransport =
      existing.pickup_melbourne_airport != null || existing.dropoff_melbourne_airport != null
    if (!incomingTransport && !hasExistingTransport) {
      return jsonError("Please select an airport transport option")
    }
    if (incomingTransport === "") {
      return jsonError("Please select an airport transport option")
    }
  }

  if (parsed.data.email) {
    const email = normalizeEmail(parsed.data.email)
    parsed.data.email = email
    const emailCheck = await isRegistrationEmailAvailable(email, {
      excludeRegistrationId: id,
      allowUserId: auth.sub,
    })
    if (!emailCheck.available) {
      return NextResponse.json(
        { error: getEmailInUseMessage(emailCheck.reason), code: "EMAIL_IN_USE", reason: emailCheck.reason },
        { status: 409 }
      )
    }
  }

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
  const wasSubmitted = !!existing.submitted_at
  const isSubmitting = parsed.data.submit && !wasSubmitted

  const existingFull = await getRegistrationWithAttendees(id)
  const beforeSnapshot = snapshotFromRegistration(
    existing as Record<string, unknown>,
    existingFull?.attendees
  )
  const afterSnapshot = snapshotFromFormValues({
    ...merged,
    attendees: parsed.data.attendees ?? existingFull?.attendees ?? [],
    transport_option: parsed.data.transport_option,
  })
  const contentChanged = hasRegistrationChanges(beforeSnapshot, afterSnapshot)
  const referenceWillChange =
    !!participantReference && participantReference !== existing.participant_reference

  if (!isSubmitting && !contentChanged && !referenceWillChange) {
    return NextResponse.json({
      registration: existingFull,
      unchanged: true,
    })
  }

  const earlyBirdSlot = existing.is_early_bird
    ? (existing.early_bird_slot as "interstate" | "melbourne" | "none")
    : isSubmitting && parsed.data.state
      ? await claimEarlyBirdSlot(parsed.data.state ?? existing.state, runtime.pricing)
      : ((existing.early_bird_slot as "interstate" | "melbourne" | "none") ?? "none")

  const formData = {
    ...merged,
    attendees: parsed.data.attendees ?? [],
    submit: parsed.data.submit ?? false,
  }

  const amountDue = computeAmountDue(
    formData as Parameters<typeof computeAmountDue>[0],
    earlyBirdSlot,
    runtime.pricing
  )

  let registrationNo = existing.registration_no as string
  if (isSubmitting && String(registrationNo).startsWith("DRAFT")) {
    registrationNo = await generateRegistrationNo()
  }

  let viewToken: string | undefined
  if (isSubmitting && !existing.view_token_hash) {
    const tokens = await createViewAndSignupTokens(id)
    viewToken = tokens.viewToken
  }

  const dbUpdate = mapFormToDb(formData as Parameters<typeof mapFormToDb>[0], {
    user_id: existing.user_id,
    amount_due: amountDue,
    early_bird_slot: earlyBirdSlot,
    is_early_bird: earlyBirdSlot !== "none",
    submitted_at: isSubmitting ? new Date().toISOString() : existing.submitted_at,
    registration_no: registrationNo,
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
          dietary_requirements: a.dietary_requirements ?? "",
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
    await sendRegistrationEmail(
      full,
      emailType,
      {
        request,
        ...(isSubmitting && viewToken ? { viewToken } : {}),
      }
    )
  }

  const previousSnapshot = pickRegistrationAuditSnapshot(existing as Record<string, unknown>)
  const updatedSnapshot = full
    ? pickRegistrationAuditSnapshot(full as Record<string, unknown>)
    : previousSnapshot
  const { previous, updated } = pickChangedFields(
    previousSnapshot,
    updatedSnapshot,
    [...REGISTRATION_AUDIT_FIELDS]
  )

  const attendeesChanged =
    !!parsed.data.attendees &&
    JSON.stringify(beforeSnapshot.attendees) !==
      JSON.stringify(normalizeComparableAttendees(parsed.data.attendees))

  if (
    isSubmitting ||
    Object.keys(previous).length > 0 ||
    Object.keys(updated).length > 0 ||
    attendeesChanged
  ) {
    await writeAuditLog({
      userId: auth.sub,
      action: isSubmitting ? "registration.submit" : "registration.update",
      previousValue: {
        ...previous,
        ...(attendeesChanged ? { attendees: beforeSnapshot.attendees } : {}),
      },
      updatedValue: {
        ...updated,
        ...(attendeesChanged
          ? { attendees: normalizeComparableAttendees(parsed.data.attendees) }
          : {}),
      },
      metadata: {
        registration_id: id,
        attendees_updated: attendeesChanged,
      },
      request,
    })
  }

  return NextResponse.json({ registration: full })
}
