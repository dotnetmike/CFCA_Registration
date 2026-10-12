"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

const COPIED_RESET_MS = 2000

const VALUE_CLASS =
  "min-w-0 break-all font-mono font-bold tracking-wide text-[#173F7A]"

type UniqueCodeValueProps = {
  code: string
  className?: string
}

/** Value-only chip (no label or copy button), e.g. inside the bank-app mockup. */
export const UniqueCodeValue = ({ code, className }: UniqueCodeValueProps) => (
  <span
    className={cn(
      VALUE_CLASS,
      "inline-block max-w-full rounded-lg border-2 border-[#C7D7EE] bg-[#F2F6FC] px-3 py-1 text-2xl sm:text-3xl",
      className
    )}
  >
    {code}
  </span>
)

const copyWithTextarea = (text: string) => {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)
  if (!copied) throw new Error("Copy command was rejected")
}

/** Clipboard API needs a secure context and permission; fall back to execCommand otherwise. */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    copyWithTextarea(text)
  }
}

type UniqueCodeProps = {
  code: string
  label?: string
  className?: string
}

export const UniqueCode = ({ code, label = "Unique Code", className }: UniqueCodeProps) => {
  const [isCopied, setIsCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const canCopy = code.trim().length > 0 && code !== "—"

  useEffect(() => {
    if (!isCopied && !copyFailed) return
    const timeoutId = window.setTimeout(() => {
      setIsCopied(false)
      setCopyFailed(false)
    }, COPIED_RESET_MS)
    return () => window.clearTimeout(timeoutId)
  }, [isCopied, copyFailed])

  const handleCopy = async () => {
    try {
      await copyText(code)
      setIsCopied(true)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium text-[#64748B]">{label}</p>
      <div className="inline-flex max-w-full items-stretch overflow-hidden rounded-lg border-2 border-[#C7D7EE] bg-[#F2F6FC]">
        <span className={cn(VALUE_CLASS, "px-4 py-2 text-2xl sm:text-3xl")}>{code}</span>
        {canCopy ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex shrink-0 items-center justify-center border-l-2 border-[#C7D7EE] px-3 text-[#173F7A] transition-colors hover:bg-[#C7D7EE]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ring)]"
            aria-label={isCopied ? `${label} copied` : `Copy ${label} ${code}`}
            title={isCopied ? "Copied" : "Copy"}
          >
            {isCopied ? (
              <Check className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Copy className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
      <p className="min-h-4 text-xs text-[#64748B]" aria-live="polite">
        {isCopied ? "Copied to clipboard" : copyFailed ? "Could not copy — please copy it manually" : ""}
      </p>
    </div>
  )
}
