# Database backup, restore, and go-live cleanup

Tooling in [`scripts/db/`](../../scripts/db/) talks to Supabase through the Management API (`SUPABASE_ACCESS_TOKEN`) for the project selected by `env:select` (see [environments.md](./environments.md)). Every command prints `APP_ENV` and the project ref first — check it.

| Command | What it does | Changes data? |
|---|---|---|
| `npm run db:backup` | Full backup of every `public` table, sequences, schema snapshot, and storage files | No |
| `npm run db:backup:verify -- --backup "<folder>"` | Integrity + restore rehearsal + cleanup coverage; writes `verification-report.json` | No (uses a temporary `cfca_restore_check` schema, dropped afterwards) |
| `npm run db:go-live-cleanup -- --backup "<folder>"` | Dry run: shows the plan and rehearses the delete transaction (rolled back) | No |
| `npm run db:go-live-cleanup -- --backup "<folder>" --execute --confirm-project <ref>` | Go-live cleanup | **Yes** |
| `npm run db:restore -- --backup "<folder>" --confirm-project <ref>` | Restore a backup into the same project | **Yes** (inserts only) |

## Backup folder

Default location: `../CFCA_Registration_Backups/<env>-<projectRef>-<timestamp>/` (outside the repo; `--out <dir>` to change).

- `manifest.json` — tables (restore order, row counts, checksums, content hashes), sequences, storage objects
- `data/<table>.json` — every row of every `public` table
- `restore.sql` — standalone restore you can paste into the Supabase SQL editor (inserts every row; existing rows untouched; sequences moved forward)
- `schema/` — live schema snapshot (columns, constraints, indexes, enums, functions, RLS policies) + copy of `supabase/setup.sql` and migrations
- `storage/` — downloaded storage files (e.g. `bank-statements`)
- `verification-report.json`, `cleanup-log.json` — written by verify / cleanup

The folder contains personal data and password hashes: keep it private, never commit it.

## Go-live cleanup

Defined once in [`scripts/db/lib/cleanup-plan.ts`](../../scripts/db/lib/cleanup-plan.ts).

| Cleared | Kept |
|---|---|
| `registrations`, `registration_attendees`, `registration_admin_notes`, `payments`, `bank_statements`, `bank_transactions`, `bank-statements` storage files | `runtime_registration_settings` (all Settings: dates, prices, workflow, bank details…) |
| `email_log`, `audit_log` | `user_groups`, `permissions`, `user_group_permissions` |
| `refresh_tokens`, `password_reset_tokens` (everyone signs in again) | `schema_migrations`, `early_bird_counters` (legacy, unused) |
| `users` not in the `admin` group (+ their `user_user_groups`) | `admin` users and all their group memberships |

`registration_no_seq` restarts at 1 (first live registration is `<prefix>-000001`). Early-bird slot counts and Unique Codes are computed from `registrations`, so they start fresh automatically.

Safety rails:

1. Refuses to run unless `verification-report.json` passed for that exact backup.
2. Immediately before deleting, re-proves every row it would delete is in the backup with identical content; aborts if anything changed (take a new backup).
3. Every table must be classified as cleared or kept — a new table aborts the run until the plan is updated.
4. One transaction: locks the affected tables, re-checks the row counts, aborts if no active admin would remain, then deletes. All or nothing.
5. `--execute` also needs `--confirm-project <ref>`.

### Runbook

```powershell
npm run db:backup
npm run db:backup:verify -- --backup "<new folder>"
npm run db:go-live-cleanup -- --backup "<new folder>"            # review the dry run
npm run db:go-live-cleanup -- --backup "<new folder>" --execute --confirm-project <ref>
```

Take the backup right before the cleanup (ideally with registration closed) so no new activity lands in between; the cleanup aborts safely if it does.

## Restore (worst case)

```powershell
npm run db:restore -- --backup "<folder>" --confirm-project <ref>
```

Re-inserts every backed-up row parents-first; rows that still exist (same key or unique value, e.g. kept admins and settings) are left as they are, so it is safe after the cleanup and safe to re-run. Sequences are moved forward to at least their backed-up value; storage files are re-uploaded if missing. Without the repo, run `restore.sql` in the Supabase SQL editor of the same project. If the schema itself were lost, recreate it first with `schema/repo-sql/setup.sql` + migrations (or `npm run db:deploy`).
