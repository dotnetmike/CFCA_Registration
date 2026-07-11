import { createAdminClient } from "@/lib/supabase/admin"
import { generateRefreshToken, hashRefreshToken } from "@/lib/auth/tokens"

const getExpiryMinutes = () => {
  const parsed = Number.parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES ?? "60", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
}

export const createPasswordResetToken = async (userId: string) => {
  const token = generateRefreshToken()
  const tokenHash = hashRefreshToken(token)
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + getExpiryMinutes())

  const admin = createAdminClient()

  await admin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("used_at", null)

  await admin.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  })

  return { token, expiresAt }
}

export const verifyPasswordResetToken = async (token: string) => {
  const tokenHash = hashRefreshToken(token)
  const admin = createAdminClient()

  const { data } = await admin
    .from("password_reset_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .maybeSingle()

  if (!data) return null
  if (new Date(data.expires_at) < new Date()) return null
  return data
}

export const markPasswordResetTokenUsed = async (tokenId: string) => {
  const admin = createAdminClient()
  await admin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId)
}
