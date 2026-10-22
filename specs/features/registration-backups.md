---
id: features.registration-backups
title: Automatic daily registration backups
status: active
synced_commit: working-tree
synced_at: 2026-10-22
owners: [team]
files:
  - src/app/dashboard/backups/page.tsx
  - src/components/backups/daily-backup-status.tsx
  - src/app/dashboard/page.tsx
  - src/app/api/admin/registration-backups/route.ts
  - src/app/api/admin/registration-backups/daily/route.ts
  - src/app/api/admin/registration-backups/[id]/download/route.ts
  - src/lib/backups/types.ts
  - src/lib/backups/archive.ts
  - src/lib/backups/service.ts
  - src/lib/backups/backups.test.ts
  - src/lib/dashboard/download-csv.ts
  - src/components/layout/dashboard-subnav.tsx
  - src/components/layout/site-header.tsx
  - supabase/migrations/027_registration_backups.sql
  - scripts/db/lib/cleanup-plan.ts
---

# Automatic daily registration backups

## Purpose

Keep a daily copy of every registration without anyone having to remember to export it. The first time an admin opens the Registrations Dashboard each day, the system checks for that day's backup and, if there is none, exports all registrations to a zipped CSV stored privately on the server. Admins can list and download every backup.

## Behavior

### Who

- Permission `backups:manage`, granted to the **admin** group only (migration 027). Managers without it never trigger, see or download backups; the APIs return **403**.

### Daily check (Registrations Dashboard)

- When a user with `backups:manage` opens `/dashboard`, the page calls `POST /api/admin/registration-backups/daily`.
- "Day" is the **Melbourne** calendar date. At most **one backup per day** (unique `backup_date`).
- If today's backup exists, nothing is created. Otherwise the server claims the day (a `processing` row), exports **all** registrations (drafts included, with attendees, paged past the 1000-row limit), zips them and uploads the zip, then marks the row `completed`.
- Concurrent visits (two admins, two tabs) create one backup only; the other visit sees it as in progress and the status line polls until it completes.
- If creating the backup fails, the claim is removed so the next visit retries; the status line shows the error with a **Retry** button (spinner, disabled while running).
- A claim stuck in `processing` for more than 10 minutes (server stopped mid-backup) is discarded and retried.
- A status line under the dashboard header shows: checking (spinner) → "created just now" or "created {time} by {admin}" with registration count and size, plus a **View backups** link.

### Backup file

- Zip `registrations-backup-YYYY-MM-DD.zip` containing one CSV `registrations-YYYY-MM-DD.csv`.
- CSV columns are the same as the detailed CSV export (`features.dashboard` → Reports): every non-secret registration column, `balance_due`, readable additional attendees and souvenir orders, kids / attendee counts. Token columns are never included.
- Stored in the private Supabase Storage bucket `registration-backups` at `YYYY/registrations-backup-YYYY-MM-DD.zip`; size, registration count and SHA-256 are recorded in `registration_backups`.

### Backups page (`/dashboard/backups`)

- In the dashboard submenu and header Dashboard dropdown as **Backups** (only with `backups:manage`); others are redirected to `/dashboard`.
- Same look as the other dashboard pages: "Administration" eyebrow, heading with help tooltip, **Refresh**, KPI cards (number of backups, latest backup date + registrations, storage used), table at 100 rows per page.
- Columns: backup date, file name, registrations, size, created (Melbourne time), triggered by (admin), **Download**.
- **Download** streams the zip through `GET /api/admin/registration-backups/[id]/download` (bearer auth; the bucket is never public). The button shows a spinner and all downloads are disabled while one runs. In-progress backups cannot be downloaded.

### Logging

- Audit log: `registration.backup_create` (date, file, count, size), `registration.backup_failed` (date, error), `registration.backup_download` (backup id, date, file).

## Acceptance criteria

- [ ] Opening the Registrations Dashboard as an admin creates today's backup when none exists, and never more than one per Melbourne day
- [ ] The backup is a zip holding one CSV of all registrations with the detailed export columns and no secret tokens
- [ ] Backups are stored privately on the server (Supabase Storage) and survive redeploys
- [ ] Admins can list all backups and download any completed backup
- [ ] Non-admins cannot trigger, list or download backups (403) and do not see the Backups link
- [ ] A failed backup is retried on the next visit or with Retry; creation, failure and downloads are audited
- [ ] Every action shows a spinner and disables its trigger while running

## Out of scope

- Deleting backups / retention limits (kept until go-live cleanup).
- Scheduled backups without a dashboard visit (no cron).
- Backing up tables other than registrations (use `npm run db:backup` for a full database backup).

## Related specs

- `features.dashboard`
- `features.audit`
- `global.auth-security`
- `global.database`

## Notes for Cursor / implementers

- Pure archive building lives in `archive.ts` (`fflate` `zipSync`) and is covered by `backups.test.ts` (`npx tsx --test src/lib/backups/backups.test.ts`).
- Go-live cleanup clears `registration_backups` and empties the `registration-backups` bucket (they hold pre-go-live data); `npm run db:backup` already copies every storage bucket.
