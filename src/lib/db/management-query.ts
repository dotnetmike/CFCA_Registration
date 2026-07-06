import { runManagementQuery } from "./access-token"

export const managementSelect = async <T extends Record<string, unknown>>(
  sql: string
): Promise<T[]> => {
  const ref = await fetchManagement(sql)
  return ref as T[]
}

export const managementExecute = async (sql: string): Promise<void> => {
  await runManagementQuery(sql)
}

const fetchManagement = async (sql: string): Promise<unknown[]> => {
  const { getProjectRef } = await import("@/lib/supabase/env")
  const { getAccessToken } = await import("./access-token")

  const token = getAccessToken()
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set")

  const ref = getProjectRef()
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Management API error (${res.status}): ${body}`)
  }

  return res.json()
}
