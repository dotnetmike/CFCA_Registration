import { NextRequest, NextResponse } from "next/server"
import { jsonError } from "@/lib/auth/api"
import { getRegistrationBySignupToken } from "@/lib/registrations/view-token"

type RouteParams = { params: Promise<{ token: string }> }

export const GET = async (_request: NextRequest, { params }: RouteParams) => {
  const { token } = await params
  if (!token) return jsonError("Token required", 400)

  const registration = await getRegistrationBySignupToken(token)
  if (!registration) return jsonError("Invalid or expired signup link", 404)

  return NextResponse.json({
    email: registration.email,
    name: `${registration.given_name} ${registration.surname}`.trim(),
    given_name: registration.given_name,
    surname: registration.surname,
    registration_no: registration.registration_no,
    participant_reference: registration.participant_reference,
    alreadyLinked: !!registration.user_id,
  })
}
