import { readSetupSql } from "./access-token"
import { runManagementQuery } from "./access-token"
import { splitSqlStatements } from "./sql-split"
import { managementSelect } from "./management-query"

export const applySetupSql = async (): Promise<void> => {
  console.log("[db] Applying setup.sql via Management API...")
  const sql = readSetupSql()
  const statements = splitSqlStatements(sql)

  for (const stmt of statements) {
    if (stmt.trim().length === 0) continue
    await runManagementQuery(stmt)
  }

  console.log("[db] setup.sql applied successfully")
}

export const schemaExists = async (): Promise<boolean> => {
  try {
    await managementSelect("SELECT id FROM public.users LIMIT 1")
    return true
  } catch {
    return false
  }
}
