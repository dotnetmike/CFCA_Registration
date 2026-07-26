import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env"

let serverClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS. Never import this module into client components.
 */
export const createServerClient = (): SupabaseClient => {
  if (serverClient) return serverClient

  serverClient = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return serverClient
}

export const createAdminClient = createServerClient
