import { formatCurrency } from "@/lib/pricing/calculate"

type PaymentReferenceMockupProps = {
  uniqueCode: string
  amount: number
}

const UniqueCodeBadge = () => (
  <span className="ml-2 shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
    Unique Code
  </span>
)

const PaymentFieldRow = ({
  label,
  uniqueCode,
  hint,
  charCount,
}: {
  label: string
  uniqueCode: string
  hint: string
  charCount: number
}) => (
  <div className="border-b border-gray-200 px-4 py-3">
    <div className="flex items-start justify-between gap-2">
      <span className="pt-0.5 text-sm text-gray-600">{label}</span>
      <div className="min-w-0 flex-1 text-right">
        <div className="flex items-center justify-end gap-0">
          <span className="font-mono text-sm font-bold text-blue-700">{uniqueCode}</span>
          <UniqueCodeBadge />
        </div>
        <p className="mt-1 text-[10px] italic text-blue-600">{hint}</p>
        <p className="mt-0.5 text-right text-[10px] text-gray-400">{charCount}</p>
      </div>
    </div>
  </div>
)

export const PaymentReferenceMockup = ({ uniqueCode, amount }: PaymentReferenceMockupProps) => (
  <figure className="mx-auto w-full max-w-[280px] space-y-2" aria-label="Payment reference example">
    <div className="overflow-hidden rounded-[2rem] border-4 border-gray-800 bg-white shadow-lg">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white px-4 py-1.5 text-[10px] text-gray-900">
        <span className="font-medium">4:56</span>
        <div className="flex items-center gap-1">
          <span aria-hidden="true">●●●●</span>
          <span className="rounded border border-gray-400 px-1 text-[9px]">15</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
        <span className="text-lg text-gray-600" aria-hidden="true">‹</span>
        <h4 className="text-base font-semibold text-gray-900">Pay</h4>
      </div>

      <div className="space-y-0 bg-white">
        {/* Recipient */}
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
            PayID
          </span>
          <span className="text-sm font-medium text-gray-900">Couples for Christ Australia</span>
        </div>

        {/* From account */}
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-800 text-[9px] font-bold text-white">
              ANZ
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">ANZ One Offset</p>
              <p className="text-xs text-gray-500">$843.75</p>
            </div>
          </div>
          <span className="text-gray-400" aria-hidden="true">›</span>
        </div>

        {/* When tabs */}
        <div className="grid grid-cols-3 gap-1 border-b border-gray-200 bg-gray-100 p-2">
          <div className="rounded-md bg-white py-1.5 text-center text-xs font-medium text-gray-900 shadow-sm">
            Today
          </div>
          <div className="py-1.5 text-center text-xs text-gray-500">Later</div>
          <div className="py-1.5 text-center text-xs text-gray-500">Recurring</div>
        </div>

        {/* Amount */}
        <div className="border-b border-gray-200 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Amount</span>
            <span className="text-2xl font-semibold text-gray-900">{formatCurrency(amount)}</span>
          </div>
        </div>

        <PaymentFieldRow
          label="Message"
          uniqueCode={uniqueCode}
          hint="(Please use your Unique Code for registration)"
          charCount={266}
        />

        <PaymentFieldRow
          label="Ref."
          uniqueCode={uniqueCode}
          hint="(Please use your Unique Code for registration)"
          charCount={21}
        />

        {/* In-app important notice */}
        <div className="mx-3 my-3 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            i
          </span>
          <p className="text-[10px] leading-snug text-blue-900">
            <strong>IMPORTANT:</strong> Please include your{" "}
            <strong>Unique Code</strong> in both Message and Ref. This ensures your payment is
            matched with your registration.
          </p>
        </div>

        {/* Continue button */}
        <div className="px-4 pb-5 pt-1">
          <div
            className="w-full rounded-lg bg-blue-700 py-3 text-center text-sm font-semibold text-white"
            role="presentation"
          >
            Continue
          </div>
        </div>
      </div>
    </div>

    <figcaption className="text-center text-xs text-gray-500">
      Enter your unique code{" "}
      <span className="font-mono font-semibold text-red-600">{uniqueCode}</span> in both Message
      and Ref. when paying via your bank app.
    </figcaption>
  </figure>
)
