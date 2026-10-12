import { cn } from "@/lib/utils"

type UniqueCodeValueProps = {
  code: string
  className?: string
}

export const UniqueCodeValue = ({ code, className }: UniqueCodeValueProps) => (
  <span
    className={cn(
      "inline-block max-w-full break-all rounded-md border-2 border-red-200 bg-red-50 px-3 py-1 font-mono text-xl font-bold tracking-wide text-red-600 sm:text-2xl",
      className
    )}
  >
    {code}
  </span>
)

type UniqueCodeProps = {
  code: string
  label?: string
  className?: string
}

export const UniqueCode = ({ code, label = "Unique Code", className }: UniqueCodeProps) => (
  <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
    <strong>{label}:</strong>
    <UniqueCodeValue code={code} />
  </div>
)
