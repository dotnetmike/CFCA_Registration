import { createAdminClient } from "@/lib/supabase/admin"
import { generateRefreshToken, hashRefreshToken } from "@/lib/auth/tokens"

const SIGNUP_TOKEN_HOURS = 24

export const createViewAndSignupTokens = async (registrationId: string) => {
  const viewToken = generateRefreshToken()
  const signupToken = generateRefreshToken()
  const signupExpires = new Date()
  signupExpires.setHours(signupExpires.getHours() + SIGNUP_TOKEN_HOURS)

  const admin = createAdminClient()
  const { error } = await admin
    .from("registrations")
    .update({
      view_token_hash: hashRefreshToken(viewToken),
      view_token_created_at: new Date().toISOString(),
      signup_token_hash: hashRefreshToken(signupToken),
      signup_token_expires_at: signupExpires.toISOString(),
    })
    .eq("id", registrationId)

  if (error) throw new Error(error.message)

  return { viewToken, signupToken }
}

/** Issue a new magic-link view token without changing signup token state. */
export const refreshViewToken = async (registrationId: string) => {
  const viewToken = generateRefreshToken()
  const admin = createAdminClient()
  const { error } = await admin
    .from("registrations")
    .update({
      view_token_hash: hashRefreshToken(viewToken),
      view_token_created_at: new Date().toISOString(),
    })
    .eq("id", registrationId)

  if (error) throw new Error(error.message)
  return viewToken
}

export const getRegistrationByViewToken = async (rawToken: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("registrations")
    .select("*, registration_attendees(*)")
    .eq("view_token_hash", hashRefreshToken(rawToken))
    .maybeSingle()

  if (error || !data) return null
  return data
}

export const getRegistrationBySignupToken = async (rawToken: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("registrations")
    .select("*")
    .eq("signup_token_hash", hashRefreshToken(rawToken))
    .maybeSingle()

  if (error || !data) return null
  if (!data.signup_token_expires_at) return null
  if (new Date(data.signup_token_expires_at) < new Date()) return null
  return data
}

export const clearSignupToken = async (registrationId: string) => {
  const admin = createAdminClient()
  await admin
    .from("registrations")
    .update({
      signup_token_hash: null,
      signup_token_expires_at: null,
    })
    .eq("id", registrationId)
}

export const linkRegistrationToUser = async (registrationId: string, userId: string) => {
  const admin = createAdminClient()

  const { data: existingForUser } = await admin
    .from("registrations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (existingForUser && existingForUser.id !== registrationId) {
    throw new Error("This account already has a registration")
  }

  const { error } = await admin
    .from("registrations")
    .update({
      user_id: userId,
      signup_token_hash: null,
      signup_token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)

  if (error) throw new Error(error.message)
}

export const findUnlinkedRegistrationByEmail = async (email: string) => {
  const admin = createAdminClient()
  const { data } = await admin
    .from("registrations")
    .select("*")
    .eq("email", email)
    .is("user_id", null)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
