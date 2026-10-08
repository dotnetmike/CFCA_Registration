import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/lib/pricing/calculate"
import type { AccessTokenPayload } from "@/lib/auth/jwt"
import {
  DEFAULT_REGISTRATION_WORKFLOW,
  parseRegistrationWorkflow,
  resolveRegistrationWorkflow,
  type RegistrationWorkflow,
} from "@/lib/registration-workflow"
import { normalizeBankDetails, type BankDetails } from "@/lib/payments/bank-details"

type RuntimeSettingsRow = {
  registration_open: boolean
  registration_start_date?: string | null
  registration_end_date?: string | null
  early_bird_start: string
  early_bird_end: string
  early_bird_payment_due_date: string
  early_bird_interstate_limit?: number | null
  early_bird_vic_limit?: number | null
  payment_reminder_dates: unknown
  notification_recipient_email: string
  adult_early_bird: number
  adult_regular: number
  age_12_plus: number
  age_2_to_12: number
  registration_workflow?: string | null
  souvenir_preorder_enabled?: boolean | null
  bank_account_name?: string | null
  bank_bsb?: string | null
  bank_account_number?: string | null
}

export type RegistrationRuntimeSettings = {
  registrationOpen: boolean
  registrationStartDate: string
  registrationEndDate: string
  pricing: PricingConfig
  paymentReminderDates: string[]
  notificationRecipientEmail: string
  registrationWorkflow: RegistrationWorkflow
  souvenirPreorderEnabled: boolean
  bankDetails: BankDetails
}

export type RegistrationRuntimeSettingsInput = {
  registrationOpen: boolean
  registrationStartDate?: string
  registrationEndDate?: string
  pricing: Omit<PricingConfig, "ageFree"> & { ageFree?: number }
  paymentReminderDates: string[]
  notificationRecipientEmail: string
  registrationWorkflow?: RegistrationWorkflow
  souvenirPreorderEnabled?: boolean
  bankDetails?: Partial<BankDetails>
}

const normalizeSettings = (
  values: RegistrationRuntimeSettingsInput
): RegistrationRuntimeSettings => ({
  registrationOpen: values.registrationOpen,
  registrationStartDate: values.registrationStartDate ? values.registrationStartDate.slice(0, 10) : "",
  registrationEndDate: values.registrationEndDate ? values.registrationEndDate.slice(0, 10) : "",
  pricing: {
    ...values.pricing,
    ageFree: values.pricing.ageFree ?? DEFAULT_PRICING_CONFIG.ageFree,
    earlyBirdInterstateLimit: values.pricing.earlyBirdInterstateLimit ?? DEFAULT_PRICING_CONFIG.earlyBirdInterstateLimit,
    earlyBirdVicLimit: values.pricing.earlyBirdVicLimit ?? DEFAULT_PRICING_CONFIG.earlyBirdVicLimit,
  },
  paymentReminderDates: toDateStrings(values.paymentReminderDates),
  notificationRecipientEmail: values.notificationRecipientEmail.trim(),
  registrationWorkflow: parseRegistrationWorkflow(
    values.registrationWorkflow ?? DEFAULT_REGISTRATION_WORKFLOW
  ),
  souvenirPreorderEnabled: values.souvenirPreorderEnabled ?? false,
  bankDetails: normalizeBankDetails(values.bankDetails),
})

export const DEFAULT_REGISTRATION_RUNTIME_SETTINGS: RegistrationRuntimeSettings = {
  registrationOpen: true,
  registrationStartDate: "",
  registrationEndDate: "",
  pricing: DEFAULT_PRICING_CONFIG,
  paymentReminderDates: [],
  notificationRecipientEmail: "",
  registrationWorkflow: DEFAULT_REGISTRATION_WORKFLOW,
  souvenirPreorderEnabled: false,
  bankDetails: normalizeBankDetails(null),
}

const SETTINGS_TABLE = "runtime_registration_settings"
const SETTINGS_SELECT =
  "registration_open, registration_start_date, registration_end_date, early_bird_start, early_bird_end, early_bird_payment_due_date, early_bird_interstate_limit, early_bird_vic_limit, payment_reminder_dates, notification_recipient_email, adult_early_bird, adult_regular, age_12_plus, age_2_to_12, registration_workflow, souvenir_preorder_enabled, bank_account_name, bank_bsb, bank_account_number"

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toDateString = (value: unknown, fallback: string) => {
  const raw = String(value ?? "").trim()
  return raw ? raw.slice(0, 10) : fallback
}

const toOptionalDateString = (value: unknown) => {
  const raw = String(value ?? "").trim()
  return raw ? raw.slice(0, 10) : ""
}

const toDateStrings = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.map((date) => String(date).slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort()
    : []

export const computeIsRegistrationOpen = (
  forceOpen: boolean,
  startDate?: string | null,
  endDate?: string | null,
  nowDate = new Date()
): boolean => {
  if (!forceOpen) return false
  const today = nowDate.toISOString().slice(0, 10)
  if (startDate && startDate.trim() !== "" && today < startDate.trim()) return false
  if (endDate && endDate.trim() !== "" && today > endDate.trim()) return false
  return true
}

const mapRow = (row: RuntimeSettingsRow | null | undefined): RegistrationRuntimeSettings => {
  if (!row) return DEFAULT_REGISTRATION_RUNTIME_SETTINGS

  const forceOpen = !!row.registration_open
  const startDate = toOptionalDateString(row.registration_start_date)
  const endDate = toOptionalDateString(row.registration_end_date)
  const effectiveOpen = computeIsRegistrationOpen(forceOpen, startDate, endDate)

  return {
    registrationOpen: effectiveOpen,
    registrationStartDate: startDate,
    registrationEndDate: endDate,
    pricing: {
      adultEarlyBird: toNumber(row.adult_early_bird, DEFAULT_PRICING_CONFIG.adultEarlyBird),
      adultRegular: toNumber(row.adult_regular, DEFAULT_PRICING_CONFIG.adultRegular),
      age12Plus: toNumber(row.age_12_plus, DEFAULT_PRICING_CONFIG.age12Plus),
      age2To12: toNumber(row.age_2_to_12, DEFAULT_PRICING_CONFIG.age2To12),
      ageFree: DEFAULT_PRICING_CONFIG.ageFree,
      earlyBirdStart: toDateString(row.early_bird_start, DEFAULT_PRICING_CONFIG.earlyBirdStart),
      earlyBirdEnd: toDateString(row.early_bird_end, DEFAULT_PRICING_CONFIG.earlyBirdEnd),
      earlyBirdPaymentDueDate: toDateString(
        row.early_bird_payment_due_date,
        DEFAULT_PRICING_CONFIG.earlyBirdPaymentDueDate
      ),
      earlyBirdInterstateLimit: toNumber(
        row.early_bird_interstate_limit,
        DEFAULT_PRICING_CONFIG.earlyBirdInterstateLimit
      ),
      earlyBirdVicLimit: toNumber(
        row.early_bird_vic_limit,
        DEFAULT_PRICING_CONFIG.earlyBirdVicLimit
      ),
    },
    paymentReminderDates: toDateStrings(row.payment_reminder_dates),
    notificationRecipientEmail: String(row.notification_recipient_email ?? "").trim(),
    registrationWorkflow: parseRegistrationWorkflow(row.registration_workflow),
    souvenirPreorderEnabled: !!row.souvenir_preorder_enabled,
    bankDetails: normalizeBankDetails({
      accountName: row.bank_account_name ?? "",
      bsb: row.bank_bsb ?? "",
      accountNumber: row.bank_account_number ?? "",
    }),
  }
}

/** Effective workflow for participant UX (env override → DB → v1). */
export const getActiveRegistrationWorkflow = async (): Promise<RegistrationWorkflow> => {
  const settings = await getRegistrationRuntimeSettings()
  return resolveRegistrationWorkflow(settings.registrationWorkflow)
}

export const getRegistrationRuntimeSettings = async (): Promise<RegistrationRuntimeSettings> => {
  const admin = createAdminClient()
  const { data } = await admin
    .from(SETTINGS_TABLE)
    .select(SETTINGS_SELECT)
    .eq("id", true)
    .maybeSingle()

  return mapRow(data as RuntimeSettingsRow | null)
}

export const getRawRegistrationRuntimeSettings = async (): Promise<{
  rawRegistrationOpen: boolean
  settings: RegistrationRuntimeSettings
}> => {
  const admin = createAdminClient()
  const { data } = await admin
    .from(SETTINGS_TABLE)
    .select(SETTINGS_SELECT)
    .eq("id", true)
    .maybeSingle()

  const row = data as RuntimeSettingsRow | null
  const settings = mapRow(row)
  return {
    rawRegistrationOpen: row ? !!row.registration_open : true,
    settings,
  }
}

export const updateRegistrationRuntimeSettings = async (
  values: RegistrationRuntimeSettingsInput,
  updatedBy?: string
): Promise<RegistrationRuntimeSettings> => {
  const normalized = normalizeSettings(values)
  const admin = createAdminClient()

  const { data, error } = await admin
    .from(SETTINGS_TABLE)
    .upsert(
      {
        id: true,
        registration_open: normalized.registrationOpen,
        registration_start_date: normalized.registrationStartDate || null,
        registration_end_date: normalized.registrationEndDate || null,
        early_bird_start: normalized.pricing.earlyBirdStart,
        early_bird_end: normalized.pricing.earlyBirdEnd,
        early_bird_payment_due_date: normalized.pricing.earlyBirdPaymentDueDate,
        early_bird_interstate_limit: normalized.pricing.earlyBirdInterstateLimit,
        early_bird_vic_limit: normalized.pricing.earlyBirdVicLimit,
        payment_reminder_dates: normalized.paymentReminderDates,
        notification_recipient_email: normalized.notificationRecipientEmail,
        adult_early_bird: normalized.pricing.adultEarlyBird,
        adult_regular: normalized.pricing.adultRegular,
        age_12_plus: normalized.pricing.age12Plus,
        age_2_to_12: normalized.pricing.age2To12,
        registration_workflow: parseRegistrationWorkflow(normalized.registrationWorkflow),
        souvenir_preorder_enabled: normalized.souvenirPreorderEnabled,
        bank_account_name: normalized.bankDetails.accountName,
        bank_bsb: normalized.bankDetails.bsb,
        bank_account_number: normalized.bankDetails.accountNumber,
        updated_by: updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select(SETTINGS_SELECT)
    .single()

  if (error) throw new Error(error.message)

  return mapRow(data as RuntimeSettingsRow)
}

const PRIVILEGED_GROUPS = new Set([
  "admin",
  "registration_manager",
  "accommodation_manager",
])

export const canBypassRegistrationClosed = (user: AccessTokenPayload | null | undefined) =>
  !!user && user.groups.some((group) => PRIVILEGED_GROUPS.has(group))
