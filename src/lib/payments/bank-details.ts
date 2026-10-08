export type BankDetails = {
  accountName: string
  bsb: string
  accountNumber: string
}

export const EMPTY_BANK_DETAILS: BankDetails = {
  accountName: "",
  bsb: "",
  accountNumber: "",
}

export const BSB_PATTERN = /^\d{3}-?\d{3}$/
export const ACCOUNT_NUMBER_PATTERN = /^\d{4,10}$/

/** Formats 6 digits as `123-456`; returns trimmed input unchanged otherwise. */
export const formatBsb = (value: string) => {
  const digits = value.replace(/\D/g, "")
  return digits.length === 6 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : value.trim()
}

export const normalizeBankDetails = (value: Partial<BankDetails> | null | undefined): BankDetails => ({
  accountName: String(value?.accountName ?? "").trim(),
  bsb: formatBsb(String(value?.bsb ?? "")),
  accountNumber: String(value?.accountNumber ?? "").replace(/\s/g, ""),
})

export const isBankDetailsComplete = (value: BankDetails) =>
  Boolean(value.accountName && value.bsb && value.accountNumber)
