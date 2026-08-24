"use client"

import { Label } from "@/components/ui/label"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { cn } from "@/lib/utils"

const RequiredMark = () => (
  <span
    className="ml-1 inline-flex align-middle text-[color:var(--danger)]"
    aria-hidden="true"
    title="Required"
  >
    *
  </span>
)

type FormFieldLabelProps = {
  htmlFor?: string
  required?: boolean
  help?: string
  children: React.ReactNode
  className?: string
}

export const FormFieldLabel = ({
  htmlFor,
  required = false,
  help,
  children,
  className,
}: FormFieldLabelProps) => {
  const helpLabel =
    typeof children === "string" ? `Help for ${children}` : "Help for this field"

  return (
    <Label
      htmlFor={htmlFor}
      className={cn(
        "inline-flex flex-wrap items-center gap-y-1 text-base leading-snug",
        required ? "font-semibold text-ink" : "font-semibold text-ink",
        className
      )}
    >
      <span>{children}</span>
      {help ? <HelpTooltip content={help} label={helpLabel} className="ml-1.5" /> : null}
      {required ? (
        <>
          <RequiredMark />
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </Label>
  )
}
