import { createAdminClient } from "@/lib/supabase/admin"

export const normalizeSurnameForReference = (surname: string) => {
  const normalized = surname.trim().toUpperCase().replace(/[^A-Z]/g, "")
  return normalized || "UNKNOWN"
}

export const generateParticipantReference = async (state: string, surname: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc("generate_participant_reference", {
    p_state: state,
    p_surname: surname,
  })

  if (error) throw new Error(error.message)
  return data as string
}

export const assignParticipantReferenceIfNeeded = async (
  existingReference: string | null | undefined,
  assign: boolean,
  state: string | null | undefined,
  surname: string | null | undefined
) => {
  if (!assign || existingReference) return existingReference ?? null
  if (!state || !surname?.trim()) {
    throw new Error("State and surname are required to assign a participant reference")
  }
  return generateParticipantReference(state, surname)
}
