import { SignJWT, jwtVerify } from "jose"
import { getJwtAccessSecret } from "@/lib/supabase/env"

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY ?? "6h"

export type AccessTokenPayload = {
  sub: string
  email: string
  name: string
  permissions: string[]
  groups: string[]
}

export const signAccessToken = async (payload: AccessTokenPayload) => {
  const secret = new TextEncoder().encode(getJwtAccessSecret())
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    permissions: payload.permissions,
    groups: payload.groups,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret)
}

export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload | null> => {
  try {
    const secret = new TextEncoder().encode(getJwtAccessSecret())
    const { payload } = await jwtVerify(token, secret)
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      permissions: (payload.permissions as string[]) ?? [],
      groups: (payload.groups as string[]) ?? [],
    }
  } catch {
    return null
  }
}
