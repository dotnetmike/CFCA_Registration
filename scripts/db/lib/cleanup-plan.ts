import { existsSync, readFileSync } from "fs"
import { join } from "path"
import {
  quoteIdent,
  readTableRows,
  rowKey,
  sha256,
  sql,
  type BackupManifest,
} from "./backup-common"

const isAdminUser = (userIdColumn: string) =>
  `exists (select 1 from public.user_user_groups a join public.user_groups g on g.id = a.group_id where a.user_id = ${userIdColumn} and g.name = 'admin')`

/** Go-live cleanup: deleted in this order (children before parents). `t` is the row alias. */
export const CLEANUP_STEPS: { table: string; where: string; description: string }[] = [
  { table: "registration_backups", where: "true", description: "all daily registration backup records" },
  { table: "reconciliation_events", where: "true", description: "all reconciliation activity" },
  { table: "stripe_balance_transactions", where: "true", description: "all imported Stripe transactions" },
  { table: "bank_transactions", where: "true", description: "all legacy PDF bank statement lines" },
  { table: "payments", where: "true", description: "all payments" },
  { table: "bank_statement_lines", where: "true", description: "all imported CBA statement lines" },
  { table: "registration_admin_notes", where: "true", description: "all admin notes" },
  { table: "registration_attendees", where: "true", description: "all additional attendees" },
  { table: "email_log", where: "true", description: "all email log entries" },
  { table: "audit_log", where: "true", description: "all audit log entries" },
  { table: "registrations", where: "true", description: "all registrations" },
  { table: "bank_statements", where: "true", description: "all uploaded bank statements" },
  { table: "reconciliation_runs", where: "true", description: "all reconciliation run history" },
  { table: "password_reset_tokens", where: "true", description: "all password reset tokens" },
  { table: "refresh_tokens", where: "true", description: "all login sessions (admins sign in again)" },
  {
    table: "user_user_groups",
    where: `not ${isAdminUser("t.user_id")}`,
    description: "group memberships of non-admin users",
  },
  { table: "users", where: `not ${isAdminUser("t.id")}`, description: "all non-admin user accounts" },
]

/** Kept as-is (configuration). */
export const PRESERVED_TABLES = [
  "permissions",
  "user_groups",
  "user_group_permissions",
  "runtime_registration_settings",
  "schema_migrations",
  "early_bird_counters",
]

/** Session tokens: content may change after the backup (e.g. revoked) without losing real data. */
const VOLATILE_TABLES = new Set(["refresh_tokens", "password_reset_tokens"])

export const SEQUENCE_RESETS = [{ name: "registration_no_seq", restartWith: 1 }]

export const STORAGE_BUCKETS_TO_EMPTY = ["bank-statements", "registration-backups"]

/**
 * One transaction: lock the affected tables (concurrent writes wait), abort unless the rows to delete
 * still match the counts that were just checked against the backup, then delete and reset sequences.
 */
const REHEARSAL_MARKER = "CFCA_CLEANUP_REHEARSAL"

const rehearsalAbortSql = () => {
  const counted = [...new Set([...CLEANUP_STEPS.map((s) => s.table), ...PRESERVED_TABLES])]
  const countExpr = counted
    .map((t) => `'${t}=' || (select count(*) from public.${quoteIdent(t)})`)
    .join(` || ',' || `)
  return `DO $$ BEGIN
  RAISE EXCEPTION '${REHEARSAL_MARKER}[%]', ${countExpr};
END $$;`
}

export const buildCleanupSql = (
  expectedCounts: Record<string, number>,
  { rehearsal = false } = {}
) =>
  [
    "BEGIN;",
    `LOCK TABLE ${CLEANUP_STEPS.map((s) => `public.${quoteIdent(s.table)}`).join(", ")} IN EXCLUSIVE MODE;`,
    `DO $$ BEGIN
  IF NOT EXISTS (select 1 from public.users t where t.is_active and ${isAdminUser("t.id")}) THEN
    RAISE EXCEPTION 'No active admin account would remain - cleanup aborted';
  END IF;
${CLEANUP_STEPS.map((s) => {
  const expected = expectedCounts[s.table]
  if (expected === undefined) throw new Error(`No expected count for ${s.table}`)
  return `  IF (select count(*) from public.${quoteIdent(s.table)} t where ${s.where}) <> ${expected} THEN
    RAISE EXCEPTION 'Data in ${s.table} changed since the backup check - cleanup aborted, nothing deleted';
  END IF;`
}).join("\n")}
END $$;`,
    ...CLEANUP_STEPS.map((s) => `DELETE FROM public.${quoteIdent(s.table)} t WHERE ${s.where};`),
    ...(rehearsal
      ? [rehearsalAbortSql()]
      : [
          ...SEQUENCE_RESETS.map((s) => `ALTER SEQUENCE public.${quoteIdent(s.name)} RESTART WITH ${s.restartWith};`),
          "COMMIT;",
        ]),
  ].join("\n")

/**
 * Runs the exact cleanup transaction (locks, count guards, deletes) but raises instead of committing,
 * so Postgres rolls everything back. Returns the row counts seen inside the transaction after the deletes.
 */
export const rehearseCleanup = async (
  expectedCounts: Record<string, number>
): Promise<Record<string, number>> => {
  try {
    await sql(buildCleanupSql(expectedCounts, { rehearsal: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const match = message.match(new RegExp(`${REHEARSAL_MARKER}\\[([^\\]]*)\\]`))
    if (!match) throw new Error(`Cleanup rehearsal failed: ${message}`)
    return Object.fromEntries(
      match[1].split(",").map((pair) => {
        const [table, n] = pair.split("=")
        return [table, Number(n)]
      })
    )
  }
  throw new Error("Cleanup rehearsal did not roll back as expected")
}

export type CoverageCheck = {
  name: string
  ok: boolean
  detail: string
  /** Set for table checks: rows the cleanup would delete, all proven present in the backup. */
  table?: string
  rowsToDelete?: number
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

/**
 * Proves the backup can bring back everything the cleanup would remove:
 * every table is classified, and every row/file/sequence that would be deleted or reset
 * exists in the backup with identical content.
 */
export const checkCleanupCoverage = async (
  backupDir: string,
  manifest: BackupManifest
): Promise<CoverageCheck[]> => {
  const checks: CoverageCheck[] = []
  const liveTables = (
    await sql<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`
    )
  ).map((r) => r.table_name)
  const classified = new Set([...CLEANUP_STEPS.map((s) => s.table), ...PRESERVED_TABLES])
  const unclassified = liveTables.filter((t) => !classified.has(t))
  checks.push({
    name: "every table classified (clear / keep)",
    ok: unclassified.length === 0,
    detail: unclassified.length === 0 ? `${liveTables.length} tables` : `unclassified: ${unclassified.join(", ")}`,
  })

  const backupTables = new Map(manifest.tables.map((t) => [t.name, t]))
  for (const step of CLEANUP_STEPS) {
    const entry = backupTables.get(step.table)
    if (!entry) {
      checks.push({ name: `backup covers ${step.table}`, ok: false, detail: "table missing from backup" })
      continue
    }
    const [result] = await sql<{ rows: Record<string, unknown>[] }>(
      `select coalesce(json_agg(t), '[]'::json) as rows from public.${quoteIdent(step.table)} t where ${step.where}`
    )
    const liveRows = result?.rows ?? []
    const backupByKey = new Map(readTableRows(backupDir, entry).map((r) => [rowKey(r, entry.primaryKey), r]))
    const missing = liveRows.filter((r) => !backupByKey.has(rowKey(r, entry.primaryKey)))
    const changed = liveRows.filter((r) => {
      const backed = backupByKey.get(rowKey(r, entry.primaryKey))
      return backed !== undefined && canonical(backed) !== canonical(r)
    })
    const volatile = VOLATILE_TABLES.has(step.table)
    checks.push({
      name: `backup covers ${step.table} (${step.description})`,
      ok: missing.length === 0 && (volatile || changed.length === 0),
      detail: `${liveRows.length} rows to delete; ${missing.length} not in backup; ${changed.length} changed since backup${volatile && changed.length > 0 ? " (session tokens, acceptable)" : ""}`,
      table: step.table,
      rowsToDelete: liveRows.length,
    })
  }

  for (const reset of SEQUENCE_RESETS) {
    const backed = manifest.sequences.find((s) => s.name === reset.name)
    checks.push({
      name: `backup has sequence ${reset.name}`,
      ok: Boolean(backed),
      detail: backed ? `last_value ${backed.lastValue}` : "missing",
    })
  }

  for (const bucket of STORAGE_BUCKETS_TO_EMPTY) {
    const liveObjects = await sql<{ name: string }>(
      `select name from storage.objects where bucket_id = '${bucket.replace(/'/g, "''")}'`
    )
    const problems = liveObjects.filter(({ name }) => {
      const entry = manifest.storage.objects.find((o) => o.bucket === bucket && o.name === name)
      if (!entry) return true
      const path = join(backupDir, entry.file)
      return !existsSync(path) || sha256(readFileSync(path)) !== entry.sha256
    })
    checks.push({
      name: `backup covers storage bucket ${bucket}`,
      ok: problems.length === 0,
      detail: `${liveObjects.length} files to delete; ${problems.length} missing/corrupt in backup`,
    })
  }

  return checks
}
