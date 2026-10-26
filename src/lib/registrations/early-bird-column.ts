import { createAdminClient } from "@/lib/supabase/admin"

const UNDEFINED_COLUMN = "42703"
const RECHECK_MISSING_MS = 60_000

let columnState: { exists: boolean; checkedAt: number } | null = null

/**
 * True once migration 028 has added `registrations.early_bird_adult_limit`.
 * Until then callers keep the previous behaviour (all adults on a registration share its early-bird rate).
 */
export const hasEarlyBirdAdultLimitColumn = async () => {
  if (columnState?.exists) return true
  if (columnState && Date.now() - columnState.checkedAt < RECHECK_MISSING_MS) return false

  const { error } = await createAdminClient()
    .from("registrations")
    .select("early_bird_adult_limit")
    .limit(1)
  if (!error) {
    columnState = { exists: true, checkedAt: Date.now() }
    return true
  }
  if (error.code === UNDEFINED_COLUMN) columnState = { exists: false, checkedAt: Date.now() }
  return false
}

/** Appends `early_bird_adult_limit` to a select list when the column exists. */
export const earlyBirdLimitSelect = async (select: string) =>
  (await hasEarlyBirdAdultLimitColumn()) ? `${select}, early_bird_adult_limit` : select
