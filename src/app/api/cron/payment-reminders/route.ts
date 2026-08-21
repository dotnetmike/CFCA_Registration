import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRegistrationEmail } from "@/lib/email/send"

export const GET = async (request: NextRequest) => {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const reminderDates = [
    process.env.PAYMENT_REMINDER_DATE_1,
    process.env.PAYMENT_REMINDER_DATE_2,
    process.env.PAYMENT_REMINDER_DATE_3,
  ].filter(Boolean)

  const today = new Date().toISOString().slice(0, 10)
  if (!reminderDates.includes(today)) {
    return NextResponse.json({ message: "No reminders scheduled for today", sent: 0 })
  }

  const admin = createAdminClient()
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

  return NextResponse.json({ message: "Reminders sent", sent, date: today })
}
