"use client"

import { Label } from "@/components/ui/label"
import { HelpTooltip } from "@/components/ui/help-tooltip"
import { cn } from "@/lib/utils"

/** Shared label row height so fields with/without help icons stay aligned in grids. */
export const FORM_LABEL_ROW_CLASS = "flex h-6 w-full items-center gap-1.5"

const RequiredMark = () => (
  <span
    className="inline-flex shrink-0 text-[color:var(--danger)]"
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
        FORM_LABEL_ROW_CLASS,
        "text-base font-semibold leading-none text-ink",
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {help ? <HelpTooltip content={help} label={helpLabel} /> : null}
      {required ? (
        <>
          <RequiredMark />
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </Label>
  )
}

/** Invisible spacer matching FormFieldLabel height (e.g. align action buttons with inputs). */
export const FormLabelSpacer = ({ className }: { className?: string }) => (
  <div className={cn("h-6 w-full shrink-0", className)} aria-hidden="true" />
)
