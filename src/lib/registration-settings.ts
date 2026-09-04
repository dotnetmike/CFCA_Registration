import { createAdminClient } from "@/lib/supabase/admin"
import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/lib/pricing/calculate"
import type { AccessTokenPayload } from "@/lib/auth/jwt"

type RuntimeSettingsRow = {
  registration_open: boolean
  early_bird_start: string
  early_bird_end: string
  early_bird_payment_due_date: string
  payment_reminder_dates: unknown
  notification_recipient_email: string
  adult_early_bird: number
  adult_regular: number
  age_12_plus: number
  age_2_to_12: number
}

export type RegistrationRuntimeSettings = {
  registrationOpen: boolean
  pricing: PricingConfig
  paymentReminderDates: string[]
  notificationRecipientEmail: string
}

export type RegistrationRuntimeSettingsInput = {
  registrationOpen: boolean
  pricing: Omit<PricingConfig, "ageFree"> & { ageFree?: number }
  paymentReminderDates: string[]
  notificationRecipientEmail: string
}

const normalizeSettings = (
  values: RegistrationRuntimeSettingsInput
): RegistrationRuntimeSettings => ({
  registrationOpen: values.registrationOpen,
  pricing: {
    ...values.pricing,
    ageFree: values.pricing.ageFree ?? DEFAULT_PRICING_CONFIG.ageFree,
  },
  paymentReminderDates: toDateStrings(values.paymentReminderDates),
  notificationRecipientEmail: values.notificationRecipientEmail.trim(),
})

export const DEFAULT_REGISTRATION_RUNTIME_SETTINGS: RegistrationRuntimeSettings = {
  registrationOpen: true,
  pricing: DEFAULT_PRICING_CONFIG,
  paymentReminderDates: [],
  notificationRecipientEmail: "",
}

const SETTINGS_TABLE = "runtime_registration_settings"
const SETTINGS_SELECT =
  "registration_open, early_bird_start, early_bird_end, early_bird_payment_due_date, payment_reminder_dates, notification_recipient_email, adult_early_bird, adult_regular, age_12_plus, age_2_to_12"

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toDateString = (value: unknown, fallback: string) => {
  const raw = String(value ?? "").trim()
  return raw ? raw.slice(0, 10) : fallback
}

const toDateStrings = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.map((date) => String(date).slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort()
    : []

const mapRow = (row: RuntimeSettingsRow | null | undefined): RegistrationRuntimeSettings => {
  if (!row) return DEFAULT_REGISTRATION_RUNTIME_SETTINGS

  return {
    registrationOpen: !!row.registration_open,
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
    },
    paymentReminderDates: toDateStrings(row.payment_reminder_dates),
    notificationRecipientEmail: String(row.notification_recipient_email ?? "").trim(),
  }
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
        early_bird_start: normalized.pricing.earlyBirdStart,
        early_bird_end: normalized.pricing.earlyBirdEnd,
        early_bird_payment_due_date: normalized.pricing.earlyBirdPaymentDueDate,
        payment_reminder_dates: normalized.paymentReminderDates,
        notification_recipient_email: normalized.notificationRecipientEmail,
        adult_early_bird: normalized.pricing.adultEarlyBird,
        adult_regular: normalized.pricing.adultRegular,
        age_12_plus: normalized.pricing.age12Plus,
        age_2_to_12: normalized.pricing.age2To12,
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
