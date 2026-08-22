import { NextResponse } from "next/server"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"

export const GET = async () => {
  const settings = await getRegistrationRuntimeSettings()
  return NextResponse.json(
    { settings },
    { headers: { "Cache-Control": "no-store" } }
  )
}
