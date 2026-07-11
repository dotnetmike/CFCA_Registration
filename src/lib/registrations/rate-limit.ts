const hits = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 60 * 1000
const MAX_HITS = 10

export const checkPublicRegistrationRateLimit = (ip: string): boolean => {
  const now = Date.now()
  const entry = hits.get(ip)

  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= MAX_HITS) return false
  entry.count += 1
  return true
}
