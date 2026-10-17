/**
 * Restore a backup made by `npm run db:backup` into the SAME Supabase project.
 *
 *   npm run db:restore -- --backup "<backup folder>" --confirm-project <projectRef>
 *
 * Re-inserts every backed-up row (parents first); rows that still exist are left untouched,
 * so it is safe after the go-live cleanup and safe to re-run. Sequences are moved forward to
 * at least their backed-up value, and storage files are re-uploaded if missing.
 */
import { readFileSync } from "fs"
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
  tableRowHash,
} from "./lib/backup-common"
import { restoreTables } from "./lib/restore-core"

const main = async () => {
  const args = parseArgs()
  const { projectRef } = initEnv()
  const backupDir = requireBackupDir(args)
  const manifest = readManifest(backupDir)

  if (manifest.projectRef !== projectRef) {
    throw new Error(
      `Backup is from project ${manifest.projectRef} but the selected env points at ${projectRef}`
    )
  }
  requireProjectConfirmation(args, projectRef, "restore")

  console.log(`[restore] project=${projectRef} backup=${manifest.createdAt}`)
  await restoreTables(backupDir, manifest, "public")

  for (const seq of manifest.sequences.filter((s) => s.isCalled)) {
    const name = `public.${quoteIdent(seq.name)}`
    await sql(`select setval('${name}', greatest(${seq.lastValue}, (select last_value from ${name})), true)`)
    console.log(`  sequence ${seq.name} >= ${seq.lastValue}`)
  }

  if (manifest.storage.objects.length > 0) {
    const client = createServerClient()
    for (const obj of manifest.storage.objects) {
      const body = readFileSync(join(backupDir, obj.file))
      const { error } = await client.storage.from(obj.bucket).upload(obj.name, body, { upsert: false })
      const status = error ? (/exists/i.test(error.message) ? "already present" : `FAILED: ${error.message}`) : "uploaded"
      console.log(`  storage ${obj.bucket}/${obj.name}: ${status}`)
    }
  }

  console.log("[restore] Row counts now (live vs backup):")
  for (const entry of manifest.tables) {
    const live = await tableRowHash("public", entry.name)
    const flag = live.rowCount >= entry.rowCount ? "ok" : "LOWER THAN BACKUP"
    console.log(`  ${entry.name.padEnd(32)} live ${String(live.rowCount).padStart(6)} / backup ${String(entry.rowCount).padStart(6)} ${flag}`)
  }
  console.log("[restore] Done.")
}

main().catch((err) => {
  console.error("[restore] FAILED:", err instanceof Error ? err.message : err)
  process.exit(1)
})
