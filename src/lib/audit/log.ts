import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestMeta } from "@/lib/auth/session"

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "refreshToken",
  "refresh_token",
  "accessToken",
  "access_token",
])

export const sanitizeAuditValue = (value: unknown): unknown => {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sanitizeAuditValue)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.has(key) ? "[REDACTED]" : sanitizeAuditValue(nested)
    }
    return out
  }
  return value
}

export const pickChangedFields = (
  previous: Record<string, unknown>,
  updated: Record<string, unknown>,
  keys: string[]
) => {
  const prev: Record<string, unknown> = {}
  const next: Record<string, unknown> = {}

  for (const key of keys) {
    const before = previous[key]
    const after = updated[key]
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      prev[key] = before ?? null
      next[key] = after ?? null
    }
  }

  return { previous: prev, updated: next }
}

export const writeAuditLog = async (params: {
  userId?: string | null
  action: string
  previousValue?: unknown
  updatedValue?: unknown
  metadata?: Record<string, unknown>
  request?: NextRequest
}) => {
  try {
    const admin = createAdminClient()
    const meta = params.request ? getRequestMeta(params.request) : { userAgent: undefined, ip: undefined }

    await admin.from("audit_log").insert({
      user_id: params.userId ?? null,
      action: params.action,
      previous_value:
        params.previousValue != null ? sanitizeAuditValue(params.previousValue) : null,
      updated_value:
        params.updatedValue != null ? sanitizeAuditValue(params.updatedValue) : null,
      metadata: params.metadata ?? {},
      ip_address: meta.ip ?? null,
      user_agent: meta.userAgent ?? null,
    })
  } catch (err) {
    console.error("[audit] Failed to write log:", err)
  }
}
