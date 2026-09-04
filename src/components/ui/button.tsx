"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--mist)] disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white hover:bg-brand-strong hover:-translate-y-px active:translate-y-0",
        outline:
          "border border-[color:var(--line-strong)] bg-surface/90 text-ink hover:border-brand hover:bg-mist",
        ghost: "text-ink-soft hover:bg-surface-muted hover:text-ink",
        destructive:
          "bg-[color:var(--danger)] text-white hover:brightness-110",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
    loadingText?: string
  }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      isLoading,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const busy = !!isLoading

    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({ variant, size, className }),
            busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:pointer-events-none"
          )}
          ref={ref}
          aria-busy={busy || undefined}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    const label = busy && loadingText ? loadingText : children

    return (
      <button
        className={cn(
          buttonVariants({ variant, size, className }),
          busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:pointer-events-none"
        )}
        ref={ref}
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        {...props}
      >
        {busy && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {label}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
