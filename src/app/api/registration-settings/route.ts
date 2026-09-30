import { NextResponse } from "next/server"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { resolveRegistrationWorkflow } from "@/lib/registration-workflow"
import { isStripePaymentsEnabled } from "@/lib/stripe/config"

export const GET = async () => {
  const settings = await getRegistrationRuntimeSettings()
  const registrationWorkflow = resolveRegistrationWorkflow(settings.registrationWorkflow)
  return NextResponse.json(
    {
      settings: {
        ...settings,
        registrationWorkflow,
      },
      stripePaymentsEnabled: isStripePaymentsEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
