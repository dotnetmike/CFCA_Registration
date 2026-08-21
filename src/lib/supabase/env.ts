export const getSupabaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set")
  return url
}

export const getSupabasePublishableKey = () => {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set")
  return key
}

export const getSupabaseServiceRoleKey = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return key
}

export const getProjectRef = () => {
  const url = getSupabaseUrl()
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!match) throw new Error("Could not parse project ref from SUPABASE_URL")
  return match[1]
}

export const getJwtAccessSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set")
  return secret
}

export const getJwtRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not set")
  return secret
}

export const getRegistrationCodePrefix = () =>
  process.env.REGISTRATION_CODE_PREFIX ?? "CFCA26"
