import { cn } from "@/lib/utils"

export const Alert = ({
  className,
  children,
  variant = "info",
}: {
  className?: string
  children: React.ReactNode
  variant?: "info" | "warning" | "success" | "error"
}) => {
  const variants = {
    info: "border-[color:rgba(13,71,161,0.25)] bg-[rgba(13,71,161,0.08)] text-[color:var(--info)]",
    warning: "border-[color:rgba(138,90,18,0.28)] bg-[rgba(138,90,18,0.1)] text-[color:var(--warning)]",
    success: "border-[color:rgba(31,107,74,0.25)] bg-[rgba(31,107,74,0.08)] text-[color:var(--success)]",
    error: "border-[color:rgba(155,44,44,0.28)] bg-[rgba(155,44,44,0.08)] text-[color:var(--danger)]",
  }
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm leading-relaxed animate-fade",
        variants[variant],
        className
      )}
      role="alert"
    >
      {children}
    </div>
  )
}
