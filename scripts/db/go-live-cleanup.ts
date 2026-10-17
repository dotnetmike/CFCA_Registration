/**
 * Go-live cleanup: clean slate while keeping configuration and ADMIN accounts.
 *
 *   npm run db:go-live-cleanup -- --backup "<verified backup folder>"                       # dry run (default)
 *   npm run db:go-live-cleanup -- --backup "<folder>" --execute --confirm-project <ref>     # deletes data
 *
 * Deletes: registrations (+ attendees, admin notes, payments, bank statements/lines, statement files),
 * email log, audit log, sessions/reset tokens, and every user who is not in the `admin` group.
 * Keeps: admin users (+ their group memberships), groups, permissions, runtime settings, migrations.
 * Resets: registration_no_seq so the first live registration is <prefix>-000001.
 *
 * Refuses to run unless the backup passed `npm run db:backup:verify` and still covers every row
 * that would be deleted. All database deletes run in one transaction (all or nothing).
 */
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { createServerClient } from "@/lib/supabase/admin"
import {
  initEnv,
  parseArgs,
  quoteIdent,
  readManifest,
  requireBackupDir,
  requireProjectConfirmation,
  sql,
  type VerificationReport,
} from "./lib/backup-common"
import {
  CLEANUP_STEPS,
  PRESERVED_TABLES,
  SEQUENCE_RESETS,
  STORAGE_BUCKETS_TO_EMPTY,
  buildCleanupSql,
  checkCleanupCoverage,
  rehearseCleanup,
} from "./lib/cleanup-plan"

const countRows = async (table: string, where = "true") => {
  const [row] = await sql<{ n: number }>(
    `select count(*)::int as n from public.${quoteIdent(table)} t where ${where}`
  )
  return Number(row.n)
}

const listAdmins = () =>
  sql<{ email: string; name: string; is_active: boolean }>(
    `select u.email, u.name, u.is_active from public.users u
      where exists (select 1 from public.user_user_groups a join public.user_groups g on g.id = a.group_id where a.user_id = u.id and g.name = 'admin')
      order by u.email`
  )

const listStorageObjects = (bucket: string) =>
  sql<{ name: string }>(`select name from storage.objects where bucket_id = '${bucket.replace(/'/g, "''")}' order by name`)

const main = async () => {
  const args = parseArgs()
  const execute = args.execute === true
  const { appEnv, projectRef } = initEnv()
  const backupDir = requireBackupDir(args)
  const manifest = readManifest(backupDir)

  console.log(`[cleanup] ${execute ? "EXECUTE" : "DRY RUN"} — APP_ENV=${appEnv} project=${projectRef}`)
  if (manifest.projectRef !== projectRef) {
    throw new Error(`Backup is from project ${manifest.projectRef}, selected env is ${projectRef}`)
  }

  const reportPath = join(backupDir, "verification-report.json")
  if (!existsSync(reportPath)) throw new Error("Backup has not been verified — run npm run db:backup:verify first")
  const report = JSON.parse(readFileSync(reportPath, "utf-8")) as VerificationReport
  if (!report.ok || report.backupCreatedAt !== manifest.createdAt) {
    throw new Error("Backup verification did not pass for this backup — fix and re-run db:backup:verify")
  }
  console.log(`[cleanup] Backup ${manifest.createdAt} verified at ${report.verifiedAt}`)

  console.log("[cleanup] Re-checking the backup covers everything that would be deleted...")
  const coverage = await checkCleanupCoverage(backupDir, manifest)
  coverage.forEach((c) => console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`))
  if (!coverage.every((c) => c.ok)) {
    throw new Error("Data changed since the backup. Take a new backup (db:backup + db:backup:verify) and retry.")
  }

  const admins = await listAdmins()
  console.log(`[cleanup] Admin accounts KEPT (${admins.length}):`)
  admins.forEach((a) => console.log(`  - ${a.email} (${a.name || "no name"})${a.is_active ? "" : " [inactive]"}`))
  if (!admins.some((a) => a.is_active)) throw new Error("No active admin account would remain — aborting")

  console.log("[cleanup] Rows to DELETE (all proven present in the backup):")
  const expectedCounts: Record<string, number> = {}
  const plan: { table: string; rows: number; description: string }[] = []
  for (const step of CLEANUP_STEPS) {
    const rows = coverage.find((c) => c.table === step.table)?.rowsToDelete
    if (rows === undefined) throw new Error(`Coverage check did not report ${step.table}`)
    expectedCounts[step.table] = rows
    plan.push({ table: step.table, rows, description: step.description })
    console.log(`  ${step.table.padEnd(28)} ${String(rows).padStart(6)}  ${step.description}`)
  }
  const storagePlan: { bucket: string; names: string[] }[] = []
  for (const bucket of STORAGE_BUCKETS_TO_EMPTY) {
    const names = (await listStorageObjects(bucket)).map((o) => o.name)
    storagePlan.push({ bucket, names })
    console.log(`  storage ${bucket.padEnd(20)} ${String(names.length).padStart(6)}  files`)
  }
  SEQUENCE_RESETS.forEach((s) => console.log(`[cleanup] Sequence ${s.name} restarts at ${s.restartWith}`))
  console.log("[cleanup] Tables KEPT unchanged:")
  for (const table of PRESERVED_TABLES) console.log(`  ${table.padEnd(28)} ${String(await countRows(table)).padStart(6)}`)

  if (!execute) {
    console.log("[cleanup] Rehearsal: running the real deletes in a transaction that is rolled back...")
    const inside = await rehearseCleanup(expectedCounts)
    const deletedAll = CLEANUP_STEPS.every((s) => s.table === "users" || s.table === "user_user_groups" || inside[s.table] === 0)
    const usersLeft = inside.users
    console.log(`  inside transaction: ${Object.entries(inside).map(([t, n]) => `${t}=${n}`).join(", ")}`)
    console.log(`  [${deletedAll && usersLeft === admins.length ? "PASS" : "FAIL"}] deletes succeed; ${usersLeft} users would remain (admins: ${admins.length})`)
    const stillThere = await countRows("registrations")
    console.log(`  [${stillThere === plan.find((p) => p.table === "registrations")?.rows ? "PASS" : "FAIL"}] rolled back — registrations still ${stillThere}`)
    console.log("[cleanup] Dry run only — nothing was changed.")
    console.log(`[cleanup] To execute: npm run db:go-live-cleanup -- --backup "${backupDir}" --execute --confirm-project ${projectRef}`)
    return
  }

  requireProjectConfirmation(args, projectRef, "run the cleanup")
  console.log("[cleanup] Deleting (single transaction)...")
  await sql(buildCleanupSql(expectedCounts))

  if (storagePlan.some((s) => s.names.length > 0)) {
    const client = createServerClient()
    for (const { bucket, names } of storagePlan.filter((s) => s.names.length > 0)) {
      const { error } = await client.storage.from(bucket).remove(names)
      if (error) throw new Error(`Database cleaned but storage delete failed for ${bucket}: ${error.message}`)
    }
  }

  console.log("[cleanup] Post-checks:")
  const after: Record<string, number> = {}
  for (const step of CLEANUP_STEPS) after[step.table] = await countRows(step.table, step.where)
  const remainingUsers = await countRows("users")
  const adminsAfter = await listAdmins()
  const [seq] = await sql<{ last_value: number; is_called: boolean }>(
    `select last_value::bigint as last_value, is_called from public.registration_no_seq`
  )
  const postChecks = [
    { name: "all targeted rows deleted", ok: Object.values(after).every((n) => n === 0), detail: JSON.stringify(after) },
    { name: "only admin users remain", ok: remainingUsers === adminsAfter.length && adminsAfter.length === admins.length, detail: `${remainingUsers} users, ${adminsAfter.length} admins` },
    { name: "registration number restarts at 1", ok: Number(seq.last_value) === 1 && !seq.is_called, detail: `last_value ${seq.last_value}, is_called ${seq.is_called}` },
  ]
  postChecks.forEach((c) => console.log(`  [${c.ok ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`))

  writeFileSync(
    join(backupDir, "cleanup-log.json"),
    JSON.stringify({ executedAt: new Date().toISOString(), projectRef, plan, storagePlan, keptAdmins: admins.map((a) => a.email), postChecks }, null, 2)
  )
  console.log(`[cleanup] ${postChecks.every((c) => c.ok) ? "Done" : "Done WITH WARNINGS"} — log saved to cleanup-log.json in the backup folder.`)
}

main().catch((err) => {
  console.error("[cleanup] ABORTED:", err instanceof Error ? err.message : err)
  process.exit(1)
})
