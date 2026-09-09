import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string
  hint?: string
  tone?: "brand" | "success" | "warning" | "info"
  icon?: ReactNode
  className?: string
  style?: React.CSSProperties
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  brand: "bg-brand/10 text-brand",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  info: "bg-sky-100 text-sky-800",
}

export const StatCard = ({
  label,
  value,
  hint,
  tone = "brand",
  icon,
  className,
  style,
}: StatCardProps) => (
  <div className={cn("cfca-stat-card", className)} style={style}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
          {label}
        </p>
        <p className="font-display text-3xl font-semibold tracking-tight text-ink tabular-nums">
          {value}
        </p>
        {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
    </div>
  </div>
)
