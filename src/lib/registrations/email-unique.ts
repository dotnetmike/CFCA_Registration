import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeEmail } from "@/lib/utils"

export const EMAIL_IN_USE_MESSAGE =
  "This email is already registered. Please log in to your account instead."

type EmailCheckOptions = {
  excludeRegistrationId?: string | null
  allowUserId?: string | null
}

export const isRegistrationEmailAvailable = async (
  email: string,
  options: EmailCheckOptions = {}
): Promise<{ available: boolean; reason?: "registration" | "account" }> => {
  const normalized = normalizeEmail(email)
  if (!normalized) return { available: true }

  const admin = createAdminClient()

  const { data: registrations } = await admin
    .from("registrations")
    .select("id, user_id")
    .ilike("email", normalized)

  const conflict = (registrations ?? []).find(
    (row) => row.id !== options.excludeRegistrationId
  )
  if (conflict) {
    return { available: false, reason: "registration" }
  }

  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle()

  if (user && user.id !== options.allowUserId) {
    return { available: false, reason: "account" }
  }

  return { available: true }
}
