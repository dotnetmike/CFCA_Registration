import { NextRequest, NextResponse } from "next/server"
import { jsonError } from "@/lib/auth/api"
import { getRegistrationByViewToken } from "@/lib/registrations/view-token"

type RouteParams = { params: Promise<{ token: string }> }

export const GET = async (_request: NextRequest, { params }: RouteParams) => {
  const { token } = await params
  if (!token) return jsonError("Token required", 400)

  const registration = await getRegistrationByViewToken(token)
  if (!registration) return jsonError("Registration not found or invalid link", 404)

  const { view_token_hash: _v, signup_token_hash: _s, signup_token_expires_at: _e, ...safe } =
    registration as Record<string, unknown> & {
      view_token_hash?: string
      signup_token_hash?: string
      signup_token_expires_at?: string
    }

  return NextResponse.json({
    registration: safe,
    hasAccount: !!registration.user_id,
  })
}
