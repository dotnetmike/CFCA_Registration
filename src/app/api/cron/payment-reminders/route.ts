import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRegistrationEmail } from "@/lib/email/send"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { runEarlyBirdExpiry } from "@/lib/registrations/early-bird-expiry-runner"

export const GET = async (request: NextRequest) => {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const settings = await getRegistrationRuntimeSettings()
  const admin = createAdminClient()
  const earlyBirdExpiry = await runEarlyBirdExpiry(settings.pricing, request).catch((err) => {
    console.error("[cron] Early-bird expiry failed:", err)
    return null
  })
  const repriced = earlyBirdExpiry?.repriced ?? 0

  if (!settings.paymentReminderDates.includes(today)) {
    return NextResponse.json({
      message: "No reminders scheduled for today",
      sent: 0,
      repriced,
      earlyBirdExpiry,
      date: today,
    })
  }
  const { data: unpaid } = await admin
    .from("registrations")
    .select("*, registration_attendees(given_name, surname, age, needs_kids_supervision)")
    .in("payment_status", ["pending", "partial"])
    .not("submitted_at", "is", null)

  let sent = 0
  for (const reg of unpaid ?? []) {
    await sendRegistrationEmail(reg, "payment_reminder", { request })
    sent++
  }

  return NextResponse.json({ message: "Reminders sent", sent, repriced, earlyBirdExpiry, date: today })
}
