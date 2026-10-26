"use client"

import { useState, type KeyboardEvent } from "react"
import { CalendarPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { calendarDateInMelbourne } from "@/lib/pricing/calculate"

/** Matches the limit in `PATCH /api/admin/registration-settings`. */
export const MAX_PAYMENT_REMINDER_DATES = 12

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const formatReminderDate = (date: string) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))

type PaymentReminderDatesFieldProps = {
  dates: string[]
  onChange: (dates: string[]) => void
}

export const PaymentReminderDatesField = ({ dates, onChange }: PaymentReminderDatesFieldProps) => {
  const [pendingDate, setPendingDate] = useState("")
  const sortedDates = [...dates].sort()
  const today = calendarDateInMelbourne()
  const isFull = dates.length >= MAX_PAYMENT_REMINDER_DATES
  const isDuplicate = dates.includes(pendingDate)
  const canAdd = DATE_PATTERN.test(pendingDate) && !isDuplicate && !isFull

  const handleAddDate = () => {
    if (!canAdd) return
    onChange([...dates, pendingDate].sort())
    setPendingDate("")
  }

  const handleRemoveDate = (date: string) => {
    onChange(dates.filter((existing) => existing !== date))
  }

  const handlePendingDateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    handleAddDate()
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="paymentReminderDateInput">Reminder dates</Label>
      <p id="paymentReminderDates-hint" className="text-sm text-ink-soft">
        On each date, registrations with a balance due get a payment reminder at about 9:00 am Melbourne
        time (8:00 am outside daylight saving). Add up to {MAX_PAYMENT_REMINDER_DATES} dates, then click
        Save Settings.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="paymentReminderDateInput"
          type="date"
          value={pendingDate}
          onChange={(event) => setPendingDate(event.target.value)}
          onKeyDown={handlePendingDateKeyDown}
          disabled={isFull}
          aria-label="Payment reminder date to add"
          aria-describedby="paymentReminderDates-hint paymentReminderDates-status"
          className="sm:max-w-56"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddDate}
          disabled={!canAdd}
          aria-label="Add payment reminder date"
          className="disabled:cursor-not-allowed"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          Add date
        </Button>
      </div>
      <p id="paymentReminderDates-status" className="text-xs text-ink-soft" aria-live="polite">
        {isFull
          ? `Maximum of ${MAX_PAYMENT_REMINDER_DATES} dates reached. Remove one to add another.`
          : isDuplicate
            ? "That date is already in the list."
            : null}
      </p>
      {sortedDates.length === 0 ? (
        <p className="text-sm text-ink-soft">No reminder dates set. No payment reminders will be sent.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Payment reminder dates">
          {sortedDates.map((date) => {
            const isPast = date < today
            return (
              <li
                key={date}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line-strong)] bg-surface-muted py-1 pl-3 pr-1 text-sm text-ink data-[past=true]:text-ink-soft"
                data-past={isPast}
              >
                <span>
                  {formatReminderDate(date)}
                  {isPast ? " (past)" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDate(date)}
                  className="rounded-full p-1 text-ink-soft transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed"
                  aria-label={`Remove reminder date ${formatReminderDate(date)}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
