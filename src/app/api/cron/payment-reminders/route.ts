import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRegistrationEmail } from "@/lib/email/send"
import { getRegistrationRuntimeSettings } from "@/lib/registration-settings"
import { runEarlyBirdExpiry } from "@/lib/registrations/early-bird-expiry-runner"
import { calendarDateInMelbourne } from "@/lib/pricing/calculate"
import {
  PAYMENT_REMINDER_RUN_ACTION,
  createEmailPacer,
  isEarliestRun,
  registrationsAwaitingRepricing,
  remindedRegistrationIds,
  type ReminderLogRow,
  type ReminderRunRow,
} from "@/lib/payments/payment-reminders"

export const maxDuration = 300

/** Stop starting new emails well before `maxDuration`; whatever is left goes in the next run. */
const RUN_BUDGET_MS = 250_000
/** A run started within this window may still be sending, so a later start in the window stands down. */
const RUN_LOCK_WINDOW_MS = (maxDuration + 30) * 1000
/** Look back far enough to cover a whole Melbourne day in either daylight-saving offset. */
const REMINDER_LOOKBACK_MS = 36 * 60 * 60 * 1000

type AdminClient = ReturnType<typeof createAdminClient>

/** Records this run and reports whether it is the earliest one in the lock window. Fails open if the log is unavailable. */
const claimRun = async (admin: AdminClient, runId: string, today: string) => {
  const { error } = await admin.from("audit_log").insert({
    user_id: null,
    action: PAYMENT_REMINDER_RUN_ACTION,
    metadata: { run_id: runId, date: today },
  })
  if (error) {
    console.error("[cron] Could not record payment reminder run:", error.message)
    return true
  }
  const { data, error: readError } = await admin
    .from("audit_log")
    .select("id, created_at, metadata")
    .eq("action", PAYMENT_REMINDER_RUN_ACTION)
    .gte("created_at", new Date(Date.now() - RUN_LOCK_WINDOW_MS).toISOString())
  if (readError) {
    console.error("[cron] Could not read payment reminder runs:", readError.message)
    return true
  }
  return isEarliestRun((data ?? []) as ReminderRunRow[], runId)
}

const loadRemindedToday = async (admin: AdminClient, today: string) => {
  const { data, error } = await admin
    .from("email_log")
    .select("registration_id, sent_at, resend_id")
    .eq("email_type", "payment_reminder")
    .gte("sent_at", new Date(Date.now() - REMINDER_LOOKBACK_MS).toISOString())
  if (error) throw new Error(error.message)
  return remindedRegistrationIds((data ?? []) as ReminderLogRow[], today)
}

export const GET = async (request: NextRequest) => {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pacer = createEmailPacer({ deadlineMs: Date.now() + RUN_BUDGET_MS })
  const today = calendarDateInMelbourne()
  const admin = createAdminClient()

  if (!(await claimRun(admin, randomUUID(), today))) {
    return NextResponse.json({
      message: "Another payment reminder run is already in progress",
      sent: 0,
      repriced: 0,
      earlyBirdExpiry: null,
      date: today,
    })
  }

  const settings = await getRegistrationRuntimeSettings()
  const earlyBirdExpiry = await runEarlyBirdExpiry(settings.pricing, request, pacer).catch((err) => {
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

  if (!earlyBirdExpiry) {
    console.error("[cron] Payment reminders held: early-bird repricing did not complete")
    return NextResponse.json(
      {
        error: "Early-bird repricing failed; reminders held so fees are not shown before repricing",
        sent: 0,
        repriced,
        earlyBirdExpiry,
        date: today,
      },
      { status: 500 }
    )
  }
  const awaitingRepricing = registrationsAwaitingRepricing(earlyBirdExpiry)

  let remindedToday: Set<string>
  try {
    remindedToday = await loadRemindedToday(admin, today)
  } catch (err) {
    console.error("[cron] Could not check today's payment reminders; none sent:", err)
    return NextResponse.json(
      { error: "Could not check today's payment reminders", sent: 0, repriced, earlyBirdExpiry, date: today },
      { status: 500 }
    )
  }

  const { data: unpaid } = await admin
    .from("registrations")
    .select("*, registration_attendees(given_name, surname, age, needs_kids_supervision)")
    .in("payment_status", ["pending", "partial"])
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: true })

  let sent = 0
  let alreadyReminded = 0
  let heldForRepricing = 0
  let failed = 0
  let deferred = 0
  for (const reg of unpaid ?? []) {
    if (remindedToday.has(reg.id)) {
      alreadyReminded++
      continue
    }
    if (awaitingRepricing.has(reg.registration_no)) {
      heldForRepricing++
      continue
    }
    if (!pacer.hasTimeForAnother()) {
      deferred++
      continue
    }
    await pacer.waitForTurn()
    try {
      const result = await sendRegistrationEmail(reg, "payment_reminder", { request })
      if (result.id || result.skipped) sent++
      else failed++
    } catch (err) {
      console.error("[cron] Payment reminder failed for", reg.registration_no, err)
      failed++
    }
  }

  return NextResponse.json({
    message:
      deferred > 0 || heldForRepricing > 0
        ? "Reminders partly sent; the rest go in the next run"
        : "Reminders sent",
    sent,
    alreadyReminded,
    heldForRepricing,
    failed,
    deferred,
    repriced,
    earlyBirdExpiry,
    date: today,
  })
}
