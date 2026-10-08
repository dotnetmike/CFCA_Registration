import { NextRequest, NextResponse } from "next/server"
import {
  getRegistrationBySignupToken,
  getRegistrationByViewToken,
} from "@/lib/registrations/view-token"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { resolveRegistrationWorkflow } from "@/lib/registration-workflow"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"
import { jsonError } from "@/lib/auth/api"

export const GET = async (request: NextRequest) => {
  const token = request.nextUrl.searchParams.get("token")
  const view = request.nextUrl.searchParams.get("view")

  let registration = null
  if (token) registration = await getRegistrationBySignupToken(token)
  else if (view) registration = await getRegistrationByViewToken(view)

  if (!registration) return jsonError("Not found", 404)

  const settings = await getRegistrationRuntimeSettings()
  const workflow = resolveRegistrationWorkflow(settings.registrationWorkflow)

  return NextResponse.json({
    registration: {
      id: registration.id,
      registration_no: registration.registration_no,
      participant_reference: registration.participant_reference,
      amount_due: registration.amount_due,
      amount_paid: registration.amount_paid,
      payment_status: registration.payment_status,
      given_name: registration.given_name,
      surname: registration.surname,
    },
    registrationWorkflow: workflow,
    stripePaymentsEnabled: isStripePaymentsEnabled(),
    bankDetails: settings.bankDetails,
  })
}
