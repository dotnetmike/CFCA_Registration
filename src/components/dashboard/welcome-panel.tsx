import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type WelcomePanelProps = {
  name: string
  title?: string
  description?: string
  primaryHref?: string
  primaryLabel?: string
  secondaryAction?: ReactNode
  className?: string
}

export const WelcomePanel = ({
  name,
  title = "Conference operations",
  description = "Review registration health, payment progress, and state distribution for the 2027 CFCA National Conference.",
  primaryHref = "/dashboard",
  primaryLabel = "View registrations",
  secondaryAction,
  className,
}: WelcomePanelProps) => (
  <section className={cn("cfca-dash-hero", className)} aria-label="Welcome">
    <div className="relative z-10 flex h-full flex-col justify-between gap-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-pale">
          {title}
        </p>
        <h2 className="font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Welcome back, {name}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-white/80">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={primaryHref}
          className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-brand transition hover:bg-brand-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {primaryLabel}
        </Link>
        {secondaryAction}
      </div>
    </div>
  </section>
)
