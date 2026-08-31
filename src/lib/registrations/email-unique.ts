import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeEmail } from "@/lib/utils"

export const EMAIL_IN_USE_MESSAGE =
  "This email is already registered. Please log in to your account instead."

export const EMAIL_IN_USE_NO_ACCOUNT_MESSAGE =
  "This email already has a submitted registration, but no account has been created for it yet. Create your account to view and manage it."

export const getEmailInUseMessage = (reason?: "unlinked_registration" | "account") =>
  reason === "unlinked_registration" ? EMAIL_IN_USE_NO_ACCOUNT_MESSAGE : EMAIL_IN_USE_MESSAGE

type EmailCheckOptions = {
  excludeRegistrationId?: string | null
  allowUserId?: string | null
}

export const isRegistrationEmailAvailable = async (
  email: string,
  options: EmailCheckOptions = {}
): Promise<{ available: boolean; reason?: "unlinked_registration" | "account" }> => {
  const normalized = normalizeEmail(email)
  if (!normalized) return { available: true }

  const admin = createAdminClient()

  const { data: registrations, error: registrationError } = await admin
    .from("registrations")
    .select("id, user_id")
    .ilike("email", normalized)

  if (registrationError) {
    throw new Error(registrationError.message)
  }

  const conflict = (registrations ?? []).find(
    (row) => row.id !== options.excludeRegistrationId
  )
  if (conflict) {
    // A registration with no linked account isn't "in use" by an account yet —
    // the owner just needs to create one, not log in to something that doesn't exist.
    return conflict.user_id
      ? { available: false, reason: "account" }
      : { available: false, reason: "unlinked_registration" }
  }

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle()

  if (userError) {
    throw new Error(userError.message)
  }

  if (user && user.id !== options.allowUserId) {
    return { available: false, reason: "account" }
  }

  return { available: true }
}
