import { Mail, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SUPPORT_CONTACTS,
  SUPPORT_HELP_TEXT,
  buildSupportMailto,
  type SupportRegistrationRef,
  type SupportTopic,
} from "@/lib/support/contact"

type SupportLinkProps = {
  topic: SupportTopic
  registration: SupportRegistrationRef
  className?: string
}

export const SupportLink = ({ topic, registration, className }: SupportLinkProps) => {
  const contact = SUPPORT_CONTACTS[topic]
  return (
    <a
      href={buildSupportMailto(topic, registration)}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-[#1E5AA8] hover:text-[#173F7A] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
        className
      )}
      aria-label={`${contact.linkLabel} — opens an email to ${contact.email}`}
    >
      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="underline underline-offset-4">{contact.linkLabel}</span>
    </a>
  )
}

export const NeedHelpCard = ({ registration }: { registration: SupportRegistrationRef }) => {
  const contact = SUPPORT_CONTACTS.general
  return (
    <section aria-labelledby="need-help-heading" className="rounded-xl border border-[#E2E8F0] bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#1E5AA8]" aria-hidden="true" />
        <div className="space-y-1">
          <h2 id="need-help-heading" className="font-sans text-base font-semibold text-[#172033]">
            Need help?
          </h2>
          <p className="text-sm text-[#64748B]">{SUPPORT_HELP_TEXT}</p>
        </div>
      </div>
      <a
        href={buildSupportMailto("general", registration)}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#1E5AA8] bg-white px-4 text-sm font-semibold text-[#1E5AA8] transition-colors hover:bg-[#F2F6FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        aria-label={`${contact.linkLabel} — opens an email to ${contact.email}`}
      >
        <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
        {contact.linkLabel}
      </a>
    </section>
  )
}
