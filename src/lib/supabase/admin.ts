import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabasePublishableKey, getSupabaseUrl } from "./env"

let serverClient: SupabaseClient | null = null

export const createServerClient = (): SupabaseClient => {
  if (serverClient) return serverClient

  serverClient = createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return serverClient
}

export const createAdminClient = createServerClient
