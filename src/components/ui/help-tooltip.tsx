"use client"

import { useId, useState } from "react"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"

type HelpTooltipProps = {
  content: string
  /** Accessible name for the help trigger, e.g. "Help for Email" */
  label: string
  className?: string
}

export const HelpTooltip = ({ content, label, className }: HelpTooltipProps) => {
  const id = useId()
  const [open, setOpen] = useState(false)

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-[color:var(--line-strong)] bg-mist px-3 py-2 text-left text-sm font-normal leading-snug text-ink shadow-md"
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
