import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
} from "./tokens"
import { buildAccessPayload, getUserAuthData } from "./permissions"

export const createSession = async (
  userId: string,
  meta?: { userAgent?: string; ip?: string }
) => {
  const user = await getUserAuthData(userId)
  if (!user) throw new Error("User not found")

  const refreshToken = generateRefreshToken()
  const tokenHash = hashRefreshToken(refreshToken)
  const expiresAt = getRefreshTokenExpiry()

  const admin = createAdminClient()
  await admin.from("refresh_tokens").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    user_agent: meta?.userAgent ?? null,
    ip_address: meta?.ip ?? null,
  })

  const accessToken = await signAccessToken(buildAccessPayload(user))
  return { accessToken, refreshToken, user }
}

export const refreshSession = async (
  refreshToken: string,
  meta?: { userAgent?: string; ip?: string }
) => {
  const tokenHash = hashRefreshToken(refreshToken)
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from("refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle()

  if (!tokenRow) return null
  if (new Date(tokenRow.expires_at) < new Date()) return null

  await admin
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenRow.id)

  return createSession(tokenRow.user_id, meta)
}

export const revokeRefreshToken = async (refreshToken: string) => {
  const tokenHash = hashRefreshToken(refreshToken)
  const admin = createAdminClient()
  await admin
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
}

export const revokeAllSessions = async (userId: string) => {
  const admin = createAdminClient()
  await admin
    .from("refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null)
}

export const getRequestMeta = (request: NextRequest) => ({
  userAgent: request.headers.get("user-agent") ?? undefined,
  ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
})
