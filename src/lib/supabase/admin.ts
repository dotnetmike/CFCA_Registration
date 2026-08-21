import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env"

let serverClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role / secret key.
 * Bypasses RLS. Never import this module into client components.
 */
export const createServerClient = (): SupabaseClient => {
  if (serverClient) return serverClient

  const key = getSupabaseServiceRoleKey()
  if (key.startsWith("sb_publishable_") || key.includes("anon")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is set to a publishable/anon key. Use the project secret or legacy service_role key instead."
    )
  }

  serverClient = createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return serverClient
}

export const createAdminClient = createServerClient
