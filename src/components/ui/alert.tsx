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
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-green-200 bg-green-50 text-green-900",
    error: "border-red-200 bg-red-50 text-red-900",
  }
  return (
    <div className={cn("rounded-md border p-4 text-sm", variants[variant], className)} role="alert">
      {children}
    </div>
  )
}
