import { calendarDateInMelbourne } from "@/lib/pricing/calculate"

/** Audit action recorded at the start of each daily payment cron run; also used as the run lock. */
export const PAYMENT_REMINDER_RUN_ACTION = "cron.payment_reminders_run"

/** Exchange Online allows 30 messages per minute per mailbox; 2.5s keeps the daily job under that with headroom. */
export const EMAIL_SEND_INTERVAL_MS = 2500

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export type EmailPacer = {
  /** Whether another email can start before the run's deadline (counting the wait for its turn). */
  hasTimeForAnother: () => boolean
  /** Waits until at least `intervalMs` has passed since the previous email started. */
  waitForTurn: () => Promise<void>
}

export const createEmailPacer = ({
  deadlineMs,
  intervalMs = EMAIL_SEND_INTERVAL_MS,
  now = Date.now,
  wait = sleep,
}: {
  deadlineMs: number
  intervalMs?: number
  now?: () => number
  wait?: (ms: number) => Promise<void>
}): EmailPacer => {
  let lastStartedAt: number | null = null
  const nextStartAt = () => (lastStartedAt === null ? now() : Math.max(now(), lastStartedAt + intervalMs))

  return {
    hasTimeForAnother: () => nextStartAt() < deadlineMs,
    waitForTurn: async () => {
      const delay = nextStartAt() - now()
      if (delay > 0) await wait(delay)
      lastStartedAt = now()
    },
  }
}

export type ReminderLogRow = {
  registration_id: string | null
  sent_at: string
  resend_id: string | null
}

/** Registrations already sent a payment reminder on `today` (Melbourne date). Failed sends (no provider id) do not count. */
export const remindedRegistrationIds = (rows: ReminderLogRow[], today: string) =>
  new Set(
    rows
      .filter((row) => row.registration_id && row.resend_id && calendarDateInMelbourne(new Date(row.sent_at)) === today)
      .map((row) => row.registration_id as string)
  )

export type RepricingOutcome = {
  skipped: string[]
  deferred: string[]
}

/** Registration numbers whose early-bird repricing did not finish this run, so a reminder now could show the wrong fee. */
export const registrationsAwaitingRepricing = (outcome: RepricingOutcome) =>
  new Set([...outcome.skipped, ...outcome.deferred])

export type ReminderRunRow = {
  id: string
  created_at: string
  metadata: { run_id?: unknown } | null
}

/** The earliest run started within the lock window wins; every concurrent run reaches the same answer. */
export const isEarliestRun = (rows: ReminderRunRow[], runId: string) => {
  const [first] = [...rows].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id)
  )
  return !first || first.metadata?.run_id === runId
}
