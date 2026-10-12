"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"

type HelpTooltipProps = {
  content: string
  /** Accessible name for the help trigger, e.g. "Help for Email" */
  label: string
  className?: string
}

/** Minimum gap between the tooltip and the viewport edge / trigger, in px. */
const VIEWPORT_MARGIN = 8
const TRIGGER_GAP = 6

const positionTooltip = (trigger: HTMLElement, tooltip: HTMLElement) => {
  const triggerRect = trigger.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = window.innerHeight
  const { offsetWidth: width, offsetHeight: height } = tooltip

  const centeredLeft = triggerRect.left + triggerRect.width / 2 - width / 2
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN)
  const left = Math.min(Math.max(centeredLeft, VIEWPORT_MARGIN), maxLeft)

  const belowTop = triggerRect.bottom + TRIGGER_GAP
  const aboveTop = triggerRect.top - TRIGGER_GAP - height
  const fitsBelow = belowTop + height <= viewportHeight - VIEWPORT_MARGIN
  const top = fitsBelow || aboveTop < VIEWPORT_MARGIN ? belowTop : aboveTop

  tooltip.style.left = `${left}px`
  tooltip.style.top = `${top}px`
  tooltip.style.visibility = "visible"
}

export const HelpTooltip = ({ content, label, className }: HelpTooltipProps) => {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const open = isHovered || isKeyboardFocused || isPinned

  const closeAll = () => {
    setIsHovered(false)
    setIsKeyboardFocused(false)
    setIsPinned(false)
  }

  const handlePointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") setIsHovered(true)
  }

  const handlePointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType === "mouse") setIsHovered(false)
  }

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(":focus-visible")) setIsKeyboardFocused(true)
  }

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault()
    setIsPinned((pinned) => !pinned)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") closeAll()
  }

  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const reposition = () => positionTooltip(trigger, tooltip)
    reposition()
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open, content])

  useEffect(() => {
    if (!open) return
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node)) return
      closeAll()
    }
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll()
    }
    document.addEventListener("pointerdown", handleDocumentPointerDown)
    document.addEventListener("keydown", handleDocumentKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown)
      document.removeEventListener("keydown", handleDocumentKeyDown)
    }
  }, [open])

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="-m-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onFocus={handleFocus}
        onBlur={closeAll}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <span
              ref={tooltipRef}
              id={id}
              role="tooltip"
              style={{ left: 0, top: 0, visibility: "hidden" }}
              className="pointer-events-none fixed z-[100] w-max max-w-[min(18rem,calc(100vw-1rem))] whitespace-normal break-words rounded-md border border-[color:var(--line-strong)] bg-mist px-3 py-2 text-left text-sm font-normal leading-snug text-ink shadow-md"
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  )
}
