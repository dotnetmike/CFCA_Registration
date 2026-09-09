import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type DashboardPanelProps = {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export const DashboardPanel = ({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: DashboardPanelProps) => (
  <section className={cn("cfca-section-panel flex flex-col", className)}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4 sm:px-6">
      <div className="space-y-1">
        <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
        {description ? <p className="text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
    <div className={cn("flex-1 p-5 sm:p-6", bodyClassName)}>{children}</div>
  </section>
)
