import type { ReactNode } from "react"
import { DonutChart } from "@/components/dashboard/donut-chart"
import { formatCurrency } from "@/lib/pricing/calculate"
import { PAYMENT_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES } from "@/lib/payments/labels"
import {
  collectionProgress,
  compositionRows,
  stateRegistrationRows,
  topStateInsight,
} from "@/lib/dashboard/reports-overview"
import type { ReportsPaymentStatusCounts, ReportsSummary, ReportsTotals } from "@/lib/dashboard/reports-cache"

export const PAYMENT_STATUS_COLORS: Record<keyof ReportsPaymentStatusCounts, string> = {
  pending: "#f5b82e",
  partial: "#38bdf8",
  paid: "#14a38b",
  overpaid: "#8b5cf6",
}

const COLOR_COLLECTED = "#14a38b"
const COLOR_BALANCE = "#f5b82e"

type OverviewPanelProps = {
  icon: ReactNode
  iconClassName: string
  title: string
  subtitle: string
  children: ReactNode
  footer?: string
}

const OverviewPanel = ({ icon, iconClassName, title, subtitle, children, footer }: OverviewPanelProps) => (
  <section className="cfca-section-panel flex flex-col p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`} aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink-soft">{subtitle}</p>
      </div>
    </div>
    <div className="mt-4 flex-1">{children}</div>
    {footer ? <p className="mt-4 text-xs text-ink-soft">{footer}</p> : null}
  </section>
)

const IconCard = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
)

const IconPie = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 12A9 9 0 1 1 12 3v9Z" />
    <path d="M15 3.5A9 9 0 0 1 20.5 9H15Z" />
  </svg>
)

const IconPin = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </svg>
)

const IconGroup = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="3" />
    <path d="M6 20v-1.5A4.5 4.5 0 0 1 10.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
    <circle cx="5" cy="10" r="2" />
    <circle cx="19" cy="10" r="2" />
  </svg>
)

const formatPercent = (percent: number) => `${percent.toFixed(1)}%`

const LegendDot = ({ color }: { color: string }) => (
  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
)

export const CollectionProgressPanel = ({
  totals,
  paymentStatusCounts,
}: {
  totals: ReportsTotals
  paymentStatusCounts: ReportsPaymentStatusCounts
}) => {
  const progress = collectionProgress(totals)
  const miniStats = [
    { label: "unpaid registrations", value: paymentStatusCounts.pending },
    { label: "part paid", value: paymentStatusCounts.partial },
    { label: "paid or overpaid", value: paymentStatusCounts.paid + paymentStatusCounts.overpaid },
  ]
  return (
    <OverviewPanel
      icon={<IconCard />}
      iconClassName="bg-teal-50 text-teal-700"
      title="Collection progress"
      subtitle={`Payments against ${formatCurrency(totals.amount_due)} in registration fees`}
    >
      <div className="flex items-end justify-between gap-4">
        <p className="font-display text-4xl font-semibold tabular-nums text-ink">
          {formatCurrency(totals.amount_paid)} <span className="text-base font-normal text-ink-soft">collected</span>
        </p>
        <p className="font-display text-3xl font-semibold tabular-nums text-teal-700">
          {formatPercent(progress.collectedPercent)}
        </p>
      </div>

      <div
        className="mt-4 flex h-6 overflow-hidden rounded-full bg-surface-muted text-[0.7rem] font-semibold"
        role="img"
        aria-label={`${progress.collectedPercent}% collected, ${progress.balancePercent}% balance due`}
      >
        {progress.collectedWidth > 0 ? (
          <div
            className="flex items-center justify-center text-white"
            style={{ width: `${progress.collectedWidth}%`, backgroundColor: COLOR_COLLECTED }}
          >
            {progress.collectedWidth >= 8 ? formatPercent(progress.collectedPercent) : null}
          </div>
        ) : null}
        {progress.balanceWidth > 0 ? (
          <div
            className="flex items-center justify-center text-ink"
            style={{ width: `${progress.balanceWidth}%`, backgroundColor: COLOR_BALANCE }}
          >
            {progress.balanceWidth >= 8 ? formatPercent(progress.balancePercent) : null}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <LegendDot color={COLOR_COLLECTED} />
          Collected {formatCurrency(totals.amount_paid)}
        </span>
        <span className="flex items-center gap-1.5">
          <LegendDot color={COLOR_BALANCE} />
          {PAYMENT_LABELS.balanceDue} {formatCurrency(totals.amount_remaining)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-[color:var(--line)] rounded-xl border border-[color:var(--line)] bg-mist/40 py-3 text-center">
        {miniStats.map((stat) => (
          <div key={stat.label} className="px-2">
            <dd className="font-display text-2xl font-semibold tabular-nums text-ink">{stat.value}</dd>
            <dt className="text-xs text-ink-soft">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </OverviewPanel>
  )
}

export const PaymentStatusPanel = ({
  paymentStatusCounts,
  registrations,
}: {
  paymentStatusCounts: ReportsPaymentStatusCounts
  registrations: number
}) => {
  const segments = PAYMENT_STATUSES.map((status) => ({
    key: status,
    label: PAYMENT_STATUS_LABELS[status],
    value: paymentStatusCounts[status],
    color: PAYMENT_STATUS_COLORS[status],
  }))
  return (
    <OverviewPanel
      icon={<IconPie />}
      iconClassName="bg-violet-50 text-violet-700"
      title={PAYMENT_LABELS.status}
      subtitle={`${registrations} registrations`}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <DonutChart
          segments={segments}
          centerValue={registrations}
          centerLabel="registrations"
          trackColor="#e2e8f0"
          className="h-44 w-44"
          ariaLabel={`Payment status: ${segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")}`}
        />
        <ul className="w-full flex-1 space-y-2.5 text-sm">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-ink">
                <LegendDot color={segment.color} />
                {segment.label}
              </span>
              <span className="font-semibold tabular-nums text-ink">{segment.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </OverviewPanel>
  )
}

export const StateRegistrationsPanel = ({ summary, registrations }: { summary: ReportsSummary; registrations: number }) => {
  const rows = stateRegistrationRows(summary, registrations)
  const maxRegistrations = Math.max(1, ...rows.map((row) => row.registrations))
  return (
    <OverviewPanel
      icon={<IconPin />}
      iconClassName="bg-blue-50 text-blue-700"
      title="Registrations by state"
      subtitle="Count of submitted registrations"
      footer={topStateInsight(rows)}
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">No registration data yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.state} className="grid grid-cols-[3rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="font-semibold text-ink">{row.state}</span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
                role="img"
                aria-label={`${row.state}: ${row.registrations} registrations (${row.percent}%)`}
              >
                <div
                  className={index === 0 ? "h-full rounded-full bg-[#2f6fe0]" : "h-full rounded-full bg-[#7fa8ee]"}
                  style={{ width: `${(row.registrations / maxRegistrations) * 100}%` }}
                />
              </div>
              <span className="text-right font-semibold tabular-nums text-ink">{row.registrations}</span>
            </li>
          ))}
        </ul>
      )}
    </OverviewPanel>
  )
}

export const AttendeeCompositionPanel = ({ totals }: { totals: ReportsTotals }) => {
  const rows = compositionRows(totals)
  return (
    <OverviewPanel
      icon={<IconGroup />}
      iconClassName="bg-blue-50 text-blue-700"
      title="Attendee composition"
      subtitle={`${totals.people} people across ${totals.registrations} registrations`}
      footer="Payment status counts registrations; attendee composition counts people."
    >
      <div
        className="flex h-8 overflow-hidden rounded-md text-xs font-semibold"
        role="img"
        aria-label={rows.map((row) => `${row.label} ${row.value}`).join(", ")}
      >
        {rows.map((row) =>
          row.value > 0 ? (
            <div
              key={row.key}
              className={row.key === "registrants" || row.key === "spouses" ? "flex items-center justify-center text-white" : "flex items-center justify-center text-ink"}
              style={{ width: `${row.percent}%`, backgroundColor: row.color }}
            >
              {row.percent >= 4 ? row.value : null}
            </div>
          ) : null
        )}
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {rows.map((row) => (
          <li key={row.key} className="grid grid-cols-[1fr_3rem_3.5rem] items-center gap-3">
            <span className="flex items-center gap-2 text-ink">
              <LegendDot color={row.color} />
              {row.label}
            </span>
            <span className="text-right font-semibold tabular-nums text-ink">{row.value}</span>
            <span className="text-right tabular-nums text-ink-soft">{formatPercent(row.percent)}</span>
          </li>
        ))}
      </ul>
    </OverviewPanel>
  )
}
