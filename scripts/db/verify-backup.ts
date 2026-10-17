/**
 * Verify a backup before the go-live cleanup.
 *
 *   npm run db:backup:verify -- --backup "<backup folder>"
 *
 * 1. Files intact (sha256 + row counts match the manifest).
 * 2. Restore rehearsal: restores every table into a temporary schema (cfca_restore_check) using the
 *    real restore code, and proves each table's rows are byte-for-byte identical to the live data
 *    captured at backup time. The temporary schema is dropped afterwards; public data is not touched.
 * 3. Cleanup coverage: every row / file / sequence the cleanup would delete or reset is in the backup
 *    with identical content.
 * Writes verification-report.json into the backup folder (required by the cleanup script).
 */
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import {
  initEnv,
  parseArgs,
  quoteIdent,
  readManifest,
  readTableRows,
  requireBackupDir,
  sha256,
  sql,
  tableRowHash,
  type VerificationReport,
} from "./lib/backup-common"
import { checkCleanupCoverage } from "./lib/cleanup-plan"
import { restoreTables } from "./lib/restore-core"

const SCRATCH_SCHEMA = "cfca_restore_check"

const main = async () => {
  const args = parseArgs()
  const { projectRef } = initEnv()
  const backupDir = requireBackupDir(args)
  const manifest = readManifest(backupDir)
  const checks: VerificationReport["checks"] = []
  const add = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail })
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${name} — ${detail}`)
  }

  console.log(`[verify] backup ${manifest.createdAt} (project ${manifest.projectRef})`)
  add("backup is from the selected project", manifest.projectRef === projectRef, `selected ${projectRef}`)

  console.log("[verify] 1. File integrity")
  for (const entry of manifest.tables) {
    const path = join(backupDir, entry.file)
    if (!existsSync(path)) {
      add(`file ${entry.file}`, false, "missing")
      continue
    }
    const content = readFileSync(path, "utf-8")
    const rows = readTableRows(backupDir, entry)
    add(
      `file ${entry.file}`,
      sha256(content) === entry.fileSha256 && rows.length === entry.rowCount,
      `${rows.length} rows, checksum ${sha256(content) === entry.fileSha256 ? "ok" : "MISMATCH"}`
    )
  }
  for (const obj of manifest.storage.objects) {
    const path = join(backupDir, obj.file)
    add(`storage file ${obj.bucket}/${obj.name}`, existsSync(path) && sha256(readFileSync(path)) === obj.sha256, `${obj.size} bytes`)
  }
  const restoreSqlPath = join(backupDir, "restore.sql")
  const restoreSql = existsSync(restoreSqlPath) ? readFileSync(restoreSqlPath, "utf-8") : ""
  const tablesMissingFromSql = manifest.tables.filter(
    (t) => t.rowCount > 0 && !restoreSql.includes(`INSERT INTO "public".${quoteIdent(t.name)}`)
  )
  add(
    "restore.sql contains every non-empty table",
    restoreSql.length > 0 && tablesMissingFromSql.length === 0,
    tablesMissingFromSql.length === 0 ? `${(restoreSql.length / 1024).toFixed(0)} KB` : `missing: ${tablesMissingFromSql.map((t) => t.name).join(", ")}`
  )

  console.log(`[verify] 2. Restore rehearsal into temporary schema ${SCRATCH_SCHEMA}`)
  await sql(`drop schema if exists ${quoteIdent(SCRATCH_SCHEMA)} cascade; create schema ${quoteIdent(SCRATCH_SCHEMA)};`)
  try {
    for (const entry of manifest.tables) {
      await sql(
        `create table ${quoteIdent(SCRATCH_SCHEMA)}.${quoteIdent(entry.name)} (like public.${quoteIdent(entry.name)} including defaults)`
      )
    }
    const results = await restoreTables(backupDir, manifest, SCRATCH_SCHEMA, (line) => console.log(`   ${line}`))
    for (const entry of manifest.tables) {
      const restored = await tableRowHash(SCRATCH_SCHEMA, entry.name)
      const inserted = results.find((r) => r.table === entry.name)?.inserted ?? 0
      add(
        `restored ${entry.name} identical to backed-up live data`,
        restored.rowCount === entry.rowCount && inserted === entry.rowCount && restored.rowHash === entry.rowHash,
        `${restored.rowCount}/${entry.rowCount} rows, content hash ${restored.rowHash === entry.rowHash ? "match" : "MISMATCH"}`
      )
    }
  } finally {
    await sql(`drop schema if exists ${quoteIdent(SCRATCH_SCHEMA)} cascade`)
    console.log(`   temporary schema ${SCRATCH_SCHEMA} dropped`)
  }

  console.log("[verify] 3. Cleanup coverage (everything the cleanup removes is in this backup)")
  const coverage = await checkCleanupCoverage(backupDir, manifest)
  coverage.forEach((c) => add(c.name, c.ok, c.detail))

  const report: VerificationReport = {
    ok: checks.every((c) => c.ok),
    verifiedAt: new Date().toISOString(),
    backupCreatedAt: manifest.createdAt,
    projectRef,
    checks,
  }
  writeFileSync(join(backupDir, "verification-report.json"), JSON.stringify(report, null, 2))
  console.log(`[verify] ${report.ok ? "ALL CHECKS PASSED" : "VERIFICATION FAILED"} — report saved to verification-report.json`)
  if (!report.ok) process.exit(1)
}

main().catch((err) => {
  console.error("[verify] FAILED:", err instanceof Error ? err.message : err)
  process.exit(1)
})
