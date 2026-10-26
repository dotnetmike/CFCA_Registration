import { createAdminClient } from "@/lib/supabase/admin"
import type { PricingConfig } from "@/lib/pricing/calculate"
import {
  confirmedEarlyBirdAdultsByPool,
  decideEarlyBirdAdults,
  earlyBirdAdultCount,
  earlyBirdCapForPool,
  earlyBirdPoolForState,
  isEarlyBirdClaimOpen,
  registrationEarlyBirdSlot,
  type EarlyBirdPoolId,
  type EarlyBirdRegistration,
  type EarlyBirdSlot,
} from "@/lib/pricing/early-bird"
import { hasEarlyBirdAdultLimitColumn } from "./early-bird-column"

export type EarlyBirdAssignment = {
  slot: EarlyBirdSlot
  /** Adults priced at early bird; `null` = all adults (used until the limit column exists). */
  pricingLimit: number | null
  dbFields: {
    early_bird_slot: EarlyBirdSlot
    is_early_bird: boolean
    early_bird_adult_limit?: number | null
  }
}

const POOL_SELECT = "id, state, is_early_bird, early_bird_slot, spouse_attending, amount_paid, registration_attendees(age)"

const slotForPool = (pool: EarlyBirdPoolId): EarlyBirdSlot => pool

const loadPoolConfirmedByOthers = async (
  pool: EarlyBirdPoolId,
  config: PricingConfig,
  excludeRegistrationId: string | undefined,
  hasLimitColumn: boolean
) => {
  let query = createAdminClient()
    .from("registrations")
    .select(hasLimitColumn ? `${POOL_SELECT}, early_bird_adult_limit` : POOL_SELECT)
    .eq("is_early_bird", true)
    .not("submitted_at", "is", null)
  query = pool === "melbourne" ? query.eq("state", "VIC") : query.neq("state", "VIC")
  if (excludeRegistrationId) query = query.neq("id", excludeRegistrationId)
  const { data, error } = await query.limit(10000)
  if (error) throw new Error(error.message)
  return confirmedEarlyBirdAdultsByPool((data ?? []) as EarlyBirdRegistration[], config)[pool]
}

/**
 * Early-bird adults for a registration being submitted or edited.
 * `existing` is the saved registration before this change (with its current attendees), or omitted for new ones.
 */
export const assignEarlyBird = async (params: {
  state: string | null | undefined
  adults: number
  existing?: (EarlyBirdRegistration & { id: string }) | null
  config: PricingConfig
  now?: Date
}): Promise<EarlyBirdAssignment> => {
  const { adults, existing, config } = params
  const hasLimitColumn = await hasEarlyBirdAdultLimitColumn()
  const existingSlot = existing ? registrationEarlyBirdSlot(existing) : "none"
  const existingEarlyBirdAdults = existing ? earlyBirdAdultCount(existing) : 0
  const pool: EarlyBirdPoolId =
    existingSlot !== "none" ? existingSlot : earlyBirdPoolForState(params.state)

  const claimOpen = isEarlyBirdClaimOpen(config, params.now)
  const wantsMore = adults > Math.min(existingEarlyBirdAdults, adults)
  let poolConfirmedByOthers = 0
  let canClaim = claimOpen && wantsMore
  if (canClaim) {
    try {
      poolConfirmedByOthers = await loadPoolConfirmedByOthers(pool, config, existing?.id, hasLimitColumn)
    } catch (err) {
      console.error("[early-bird] Unable to load pool usage; no new early-bird places assigned:", err)
      canClaim = false
    }
  }

  const limit = decideEarlyBirdAdults({
    adults,
    existingEarlyBirdAdults,
    poolConfirmedByOthers,
    cap: earlyBirdCapForPool(pool, config),
    claimOpen: canClaim,
  })
  const slot: EarlyBirdSlot = limit > 0 ? slotForPool(pool) : "none"

  if (!hasLimitColumn) {
    const legacySlot = existingSlot !== "none" ? existingSlot : slot
    return {
      slot: legacySlot,
      pricingLimit: null,
      dbFields: { early_bird_slot: legacySlot, is_early_bird: legacySlot !== "none" },
    }
  }

  return {
    slot,
    pricingLimit: slot === "none" ? null : limit,
    dbFields: {
      early_bird_slot: slot,
      is_early_bird: slot !== "none",
      early_bird_adult_limit: slot === "none" ? null : limit,
    },
  }
}

export const NO_EARLY_BIRD: EarlyBirdAssignment = {
  slot: "none",
  pricingLimit: null,
  dbFields: { early_bird_slot: "none", is_early_bird: false },
}
