import { AlertTriangle } from "lucide-react"
import type { PricingConfig } from "@/lib/pricing/calculate"
import { EARLY_BIRD_REMINDERS_TITLE, earlyBirdReminders } from "@/lib/pricing/early-bird"
import { cn } from "@/lib/utils"

type EarlyBirdRemindersProps = {
  pricing: PricingConfig
  className?: string
}

export const EarlyBirdReminders = ({ pricing, className }: EarlyBirdRemindersProps) => (
  <div
    role="note"
    aria-label={EARLY_BIRD_REMINDERS_TITLE}
    className={cn(
      "rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-sm leading-relaxed text-[#92400E] sm:p-4",
      className
    )}
  >
    <p className="flex items-center gap-2 font-semibold">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {EARLY_BIRD_REMINDERS_TITLE}
    </p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {earlyBirdReminders(pricing).map((reminder) => (
        <li key={reminder.label}>
          <strong>{reminder.label}:</strong> {reminder.text}
        </li>
      ))}
    </ul>
  </div>
)
