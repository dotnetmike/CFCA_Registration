import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/api"

export const GET = async (request: NextRequest) => {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({
    user: {
      id: auth.sub,
      email: auth.email,
      name: auth.name,
      groups: auth.groups,
      permissions: auth.permissions,
    },
  })
}
