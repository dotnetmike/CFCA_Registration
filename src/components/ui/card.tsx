import { cn } from "@/lib/utils"

export const Card = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => (
  <div
    className={cn(
      "cfca-section-panel transition-[border-color,transform,box-shadow] duration-300 hover:border-[color:var(--line-strong)]",
      className
    )}
  >
    {children}
  </div>
)

export const CardHeader = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => (
  <div className={cn("flex flex-col space-y-2 border-b border-[color:var(--line)] px-6 py-5", className)}>
    {children}
  </div>
)

export const CardTitle = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => (
  <h3 className={cn("font-display text-2xl font-semibold leading-tight tracking-tight text-ink", className)}>
    {children}
  </h3>
)

export const CardContent = ({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) => <div className={cn("p-6", className)}>{children}</div>
