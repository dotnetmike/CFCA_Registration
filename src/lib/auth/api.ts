import { NextRequest, NextResponse } from "next/server"
import { verifyAccessToken, type AccessTokenPayload } from "./tokens"

export type ApiContext = {
  user: AccessTokenPayload
}

export const getBearerToken = (request: NextRequest) => {
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7)
}

export const requireAuth = async (request: NextRequest): Promise<AccessTokenPayload | NextResponse> => {
  const token = getBearerToken(request)
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await verifyAccessToken(token)
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  return user
}

export const requirePermission = (
  user: AccessTokenPayload,
  permission: string
): NextResponse | null => {
  if (!user.permissions.includes(permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status })
