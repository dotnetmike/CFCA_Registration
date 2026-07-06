import { createAdminClient } from "@/lib/supabase/admin"
import { parseFullName } from "@/lib/registrations/parse-name"

export const createDraftRegistrationForUser = async (
  userId: string,
  email: string,
  fullName: string
) => {
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from("registrations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return existing.id

  const { given_name, surname } = parseFullName(fullName)

  const { data: registration, error } = await admin
    .from("registrations")
    .insert({
      registration_no: `DRAFT-${userId.slice(0, 8)}`,
      user_id: userId,
      given_name,
      surname,
      email,
      mobile: "",
      cfca_position: "member",
      amount_due: 0,
      early_bird_slot: "none",
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return registration.id
}
