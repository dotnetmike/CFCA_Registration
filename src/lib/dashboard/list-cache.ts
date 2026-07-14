/** Shared client list / value cache for dashboard pages (memory + sessionStorage). */

export const DASHBOARD_PAGE_SIZE = 100
export const DASHBOARD_LIST_CACHE_TTL_MS = 5 * 60 * 1000
export const DASHBOARD_LIST_CACHE_MAX_ROWS = 1500
const SESSION_BYTE_CAP = 800_000

type CacheEntry<T> = {
  fetchedAt: number
  rows: T[]
}

export type CachedListResult<T> = {
  rows: T[]
  fetchedAt: number
  isFresh: boolean
}

export const formatCacheAge = (fetchedAt: number, now = Date.now()) => {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

const isFresh = (fetchedAt: number, ttlMs: number, now = Date.now()) =>
  now - fetchedAt < ttlMs

export const createDashboardListCache = <T>(options: {
  storageKey: string
  maxRows?: number
  ttlMs?: number
}) => {
  const maxRows = options.maxRows ?? DASHBOARD_LIST_CACHE_MAX_ROWS
  const ttlMs = options.ttlMs ?? DASHBOARD_LIST_CACHE_TTL_MS
  let memoryCache: CacheEntry<T> | null = null

  const readSessionCache = (): CacheEntry<T> | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = sessionStorage.getItem(options.storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as CacheEntry<T>
      if (!parsed?.fetchedAt || !Array.isArray(parsed.rows)) return null
      if (parsed.rows.length > maxRows) return null
      return parsed
    } catch {
      return null
    }
  }

  const writeSessionCache = (entry: CacheEntry<T>) => {
    if (typeof window === "undefined") return
    try {
      const approxBytes = JSON.stringify(entry).length
      if (approxBytes > SESSION_BYTE_CAP) {
        sessionStorage.removeItem(options.storageKey)
        return
      }
      sessionStorage.setItem(options.storageKey, JSON.stringify(entry))
    } catch {
      try {
        sessionStorage.removeItem(options.storageKey)
      } catch {
        // ignore quota errors
      }
    }
  }

  return {
    get: (): CachedListResult<T> | null => {
      const entry = memoryCache ?? readSessionCache()
      if (!entry) return null
      if (!memoryCache) memoryCache = entry
      return {
        rows: entry.rows,
        fetchedAt: entry.fetchedAt,
        isFresh: isFresh(entry.fetchedAt, ttlMs),
      }
    },
    set: (rows: T[]) => {
      const entry: CacheEntry<T> = {
        fetchedAt: Date.now(),
        rows: rows.slice(0, maxRows),
      }
      memoryCache = entry
      writeSessionCache(entry)
      return entry
    },
    clear: () => {
      memoryCache = null
      if (typeof window === "undefined") return
      try {
        sessionStorage.removeItem(options.storageKey)
      } catch {
        // ignore
      }
    },
  }
}

type ValueEntry<T> = {
  fetchedAt: number
  value: T
}

export type CachedValueResult<T> = {
  value: T
  fetchedAt: number
  isFresh: boolean
}

export const createDashboardValueCache = <T>(options: {
  storageKey: string
  ttlMs?: number
}) => {
  const ttlMs = options.ttlMs ?? DASHBOARD_LIST_CACHE_TTL_MS
  let memoryCache: ValueEntry<T> | null = null

  const readSessionCache = (): ValueEntry<T> | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = sessionStorage.getItem(options.storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as ValueEntry<T>
      if (!parsed?.fetchedAt || parsed.value === undefined) return null
      return parsed
    } catch {
      return null
    }
  }

  const writeSessionCache = (entry: ValueEntry<T>) => {
    if (typeof window === "undefined") return
    try {
      const approxBytes = JSON.stringify(entry).length
      if (approxBytes > SESSION_BYTE_CAP) {
        sessionStorage.removeItem(options.storageKey)
        return
      }
      sessionStorage.setItem(options.storageKey, JSON.stringify(entry))
    } catch {
      try {
        sessionStorage.removeItem(options.storageKey)
      } catch {
        // ignore
      }
    }
  }

  return {
    get: (): CachedValueResult<T> | null => {
      const entry = memoryCache ?? readSessionCache()
      if (!entry) return null
      if (!memoryCache) memoryCache = entry
      return {
        value: entry.value,
        fetchedAt: entry.fetchedAt,
        isFresh: isFresh(entry.fetchedAt, ttlMs),
      }
    },
    set: (value: T) => {
      const entry: ValueEntry<T> = { fetchedAt: Date.now(), value }
      memoryCache = entry
      writeSessionCache(entry)
      return entry
    },
    clear: () => {
      memoryCache = null
      if (typeof window === "undefined") return
      try {
        sessionStorage.removeItem(options.storageKey)
      } catch {
        // ignore
      }
    },
  }
}
