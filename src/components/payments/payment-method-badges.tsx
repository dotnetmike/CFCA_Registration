import type { ReactNode } from "react"

type PaymentBadge = {
  id: string
  label: string
  className: string
  content: ReactNode
}

const AppleLogo = () => (
  <svg viewBox="0 0 14 17" className="h-3 w-3 fill-current" aria-hidden>
    <path d="M11.6 9c0-2 1.7-3 1.8-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.6-.8-2.7-.8C3.2 4.3 1.9 5.1 1.2 6.4-.3 9-.8 12.8 1.6 15.4c.6.8 1.3 1.7 2.2 1.6.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6c1 0 1.6-.8 2.1-1.6.7-1 .9-1.9.9-2-.1 0-1.8-.7-1.8-4.4ZM9.6 2.9C10.1 2.3 10.4 1.5 10.3.7c-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1Z" />
  </svg>
)

const MastercardLogo = () => (
  <span className="relative flex h-4 w-7 items-center" aria-hidden>
    <span className="absolute left-0 h-4 w-4 rounded-full bg-[#EB001B]" />
    <span className="absolute left-3 h-4 w-4 rounded-full bg-[#F79E1B] mix-blend-multiply" />
  </span>
)

const PAYMENT_BADGES: PaymentBadge[] = [
  {
    id: "visa",
    label: "Visa",
    className: "border-gray-200 bg-white text-[#1A1F71]",
    content: <span className="text-sm font-black italic tracking-tight">VISA</span>,
  },
  {
    id: "mastercard",
    label: "Mastercard",
    className: "border-gray-200 bg-white",
    content: <MastercardLogo />,
  },
  {
    id: "amex",
    label: "American Express",
    className: "border-[#006FCF] bg-[#006FCF] text-white",
    content: <span className="text-[11px] font-bold tracking-wide">AMEX</span>,
  },
  {
    id: "apple-pay",
    label: "Apple Pay",
    className: "border-black bg-black text-white",
    content: (
      <span className="flex items-center gap-0.5 text-xs font-semibold">
        <AppleLogo />
        Pay
      </span>
    ),
  },
  {
    id: "link",
    label: "Link",
    className: "border-[#00D66F] bg-[#00D66F] text-[#011E0F]",
    content: <span className="text-xs font-bold">link</span>,
  },
  {
    id: "klarna",
    label: "Klarna",
    className: "border-[#FFA8CD] bg-[#FFA8CD] text-black",
    content: <span className="text-xs font-bold">Klarna</span>,
  },
  {
    id: "zip",
    label: "Zip",
    className: "border-[#411361] bg-[#411361] text-[#AA8FFF]",
    content: <span className="text-xs font-black lowercase">zip</span>,
  },
]

export const PaymentMethodBadges = () => (
  <ul className="flex flex-wrap items-center gap-2" aria-label="Supported payment methods">
    {PAYMENT_BADGES.map((badge) => (
      <li
        key={badge.id}
        className={`flex h-7 min-w-12 items-center justify-center rounded-md border px-2 ${badge.className}`}
        title={badge.label}
      >
        <span className="sr-only">{badge.label}</span>
        {badge.content}
      </li>
    ))}
  </ul>
)
