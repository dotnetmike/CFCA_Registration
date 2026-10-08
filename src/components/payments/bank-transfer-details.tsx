import { Alert } from "@/components/ui/alert"
import { isBankDetailsComplete, type BankDetails } from "@/lib/payments/bank-details"

type BankTransferDetailsProps = {
  bankDetails: BankDetails
}

export const BankTransferDetails = ({ bankDetails }: BankTransferDetailsProps) => {
  if (!isBankDetailsComplete(bankDetails)) {
    return (
      <Alert variant="warning">
        Bank transfer details are not available yet. Please contact the registration team.
      </Alert>
    )
  }

  return (
    <dl className="space-y-2 text-sm">
      <div className="flex gap-1">
        <dt className="font-bold">Account Name:</dt>
        <dd>{bankDetails.accountName}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-bold">BSB:</dt>
        <dd>{bankDetails.bsb}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="font-bold">Account Number:</dt>
        <dd>{bankDetails.accountNumber}</dd>
      </div>
    </dl>
  )
}
