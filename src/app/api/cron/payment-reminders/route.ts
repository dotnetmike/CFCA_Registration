import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRegistrationEmail } from "@/lib/email/send"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { computeRegularAmountDue } from "@/lib/registrations/service"

export const GET = async (request: NextRequest) => {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const settings = await getRegistrationRuntimeSettings()
  const admin = createAdminClient()
  let repriced = 0
  if (today > settings.pricing.earlyBirdPaymentDueDate) {
    const { data: overdueEarlyBird } = await admin
      .from("registrations")
      .select("id, spouse_attending, souvenir_orders, registration_attendees(age)")
      .eq("is_early_bird", true)
      .in("payment_status", ["pending", "partial"])

    for (const registration of overdueEarlyBird ?? []) {
      const amountDue = computeRegularAmountDue(registration, settings.pricing)
      const { error } = await admin
        .from("registrations")
        .update({ amount_due: amountDue, is_early_bird: false, early_bird_slot: "none", updated_at: new Date().toISOString() })
        .eq("id", registration.id)
      if (!error) repriced++
    }
  }

  if (!settings.paymentReminderDates.includes(today)) {
    return NextResponse.json({ message: "No reminders scheduled for today", sent: 0, repriced, date: today })
  }
  const { data: unpaid } = await admin
    .from("registrations")
    .select("*")
    .in("payment_status", ["pending", "partial"])
    .not("submitted_at", "is", null)

  let sent = 0
  for (const reg of unpaid ?? []) {
    await sendRegistrationEmail(reg, "payment_reminder", { request })
    sent++
  }

  return NextResponse.json({ message: "Reminders sent", sent, repriced, date: today })
}
