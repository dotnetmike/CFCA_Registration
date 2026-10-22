# Data model

Spec: `global.database`. Schema evolves only via numbered migrations in `supabase/migrations/`.

## Entity relationship (simplified)

```mermaid
erDiagram
  users ||--o{ user_user_groups : has
  user_groups ||--o{ user_user_groups : includes
  user_groups ||--o{ user_group_permissions : grants
  permissions ||--o{ user_group_permissions : granted
  users ||--o{ refresh_tokens : sessions
  users ||--o| registrations : owns
  registrations ||--o{ registration_attendees : includes
  registrations ||--o{ registration_admin_notes : notes
  users ||--o{ runtime_registration_settings : updated_by
  registrations ||--o{ payments : receives
  users ||--o{ payments : created_by
  users ||--o{ registration_admin_notes : authored
  users ||--o{ audit_log : actor
  bank_statements ||--o{ bank_transactions : contains_legacy_pdf
  bank_statements ||--o{ payments : legacy_pdf_source
  registrations ||--o{ bank_transactions : matched_legacy
  reconciliation_runs ||--o{ reconciliation_events : logs
  reconciliation_runs ||--o{ stripe_balance_transactions : imported_by
  reconciliation_runs ||--o{ bank_statement_lines : imported_by
  registrations ||--o{ stripe_balance_transactions : matched
  payments ||--o| stripe_balance_transactions : linked
  registrations ||--o{ bank_statement_lines : matched
  bank_statement_lines ||--o{ payments : applied_from
  bank_statement_lines ||--o{ stripe_balance_transactions : settled_in
  users ||--o{ reconciliation_events : actor

  users {
    uuid id PK
    text email
    text password_hash
    text name
  }
  registrations {
    uuid id PK
    text registration_no
    text participant_reference
    text email
    numeric amount_due
    numeric amount_paid
    payment_status payment_status
    text ministry
    cfca_position cfca_position
    bool elder_assembly_attending
    jsonb souvenir_orders
    payment_source payment_last_updated_source
  }
  payments {
    uuid id PK
    uuid registration_id FK
    numeric amount
    payment_source source
    text stripe_payment_intent_id
    uuid reconciliation_bank_line_id FK
  }
  stripe_balance_transactions {
    uuid id PK
    text stripe_txn_id UK
    text type
    numeric net
    timestamptz available_on_utc
    reconciliation_status status
    bool manual_override
    uuid matched_registration_id FK
    uuid payment_id FK
    text payout_id
    uuid bank_line_id FK
    date bank_received_date
  }
  bank_statement_lines {
    uuid id PK
    text fingerprint UK
    date transaction_date
    numeric amount
    text kind
    reconciliation_status status
    bool manual_override
    uuid matched_registration_id FK
    text matched_stripe_payout_id
  }
  reconciliation_runs {
    uuid id PK
    text source
    text status
    int matched
    int unmatched
    int bank_confirmed
  }
  reconciliation_events {
    uuid id PK
    text item_type
    uuid item_id
    text action
    text comment
    uuid actor_id FK
  }
  runtime_registration_settings {
    bool id PK
    bool registration_open
    date registration_start_date
    date registration_end_date
    date early_bird_start
    date early_bird_end
    date early_bird_payment_due_date
    int early_bird_interstate_limit
    int early_bird_vic_limit
    jsonb payment_reminder_dates
    text notification_recipient_email
    text registration_workflow
    bool souvenir_preorder_enabled
    text bank_account_name
    text bank_bsb
    text bank_account_number
    numeric adult_early_bird
    numeric adult_regular
    numeric age_12_plus
    numeric age_2_to_12
  }
  audit_log {
    uuid id PK
    uuid user_id
    text action
    jsonb previous_value
    jsonb updated_value
  }
```

## Important registration fields

| Field | Role |
|-------|------|
| `registration_no` | Display / alternate payment match |
| `participant_reference` | **Unique Code** for bank Message/Ref |
| `souvenir_orders` | `[{ size, quantity }, …]` t-shirts |
| `pickup_*` / `dropoff_*` | Transport flags + admin contacts |
| `hotel_name` / `hotel_address` | UI: Accommodation name/address |
| `runtime_registration_settings` | Admin runtime controls for registration open/close, early bird window, and pricing |
| `ministry` / `cfca_position` | Ministry and Ministry Role; Non-member ministry requires Non-member role |
| `elder_assembly_attending` | Attendance response shown for eligible leadership roles |
| `view_token_hash` / signup tokens | Magic link + account link |

## Reconciliation tables (migration 025)

| Table | Role |
|-------|------|
| `reconciliation_runs` | One row per upload / re-check (counters, file SHA-256, error); `processing` acts as a 10-minute run lock |
| `stripe_balance_transactions` | Stripe balance history rows, unique by `stripe_txn_id`; status + match + admin override fields; bank settlement (`payout_id`, `bank_line_id`, `bank_received_date`) recomputed after every run (migration 026) |
| `bank_statement_lines` | CBA CSV lines, unique by `fingerprint`; `kind` = transfer / stripe_payout / debit |
| `reconciliation_events` | Activity log per row and run (from/to status, amount, comment, actor) |
| `payments.reconciliation_bank_line_id` | Payment applied (positive) or reversed (negative) from a bank line |

Status enum `reconciliation_status`: `matched`, `unmatched`, `ignored`, `not_applicable`. FK direction is `payments → bank_statement_lines` only (no cycles, required by the backup tool). See `features.payment-reconciliation`.

## Registration backups (migration 027)

| Table / object | Role |
|-------|------|
| `registration_backups` | One row per Melbourne day (`backup_date` unique): `processing` claim → `completed` with `file_path`, `file_name`, `size_bytes`, `registration_count`, `file_sha256`, `created_by` (FK users, `ON DELETE SET NULL`) |
| Storage bucket `registration-backups` (private) | `YYYY/registrations-backup-YYYY-MM-DD.zip`, one detailed registrations CSV inside |
| Permission `backups:manage` | Admin group only |

See `features.registration-backups`.

## Groups (seeded)

`admin`, `registration_manager`, `accommodation_manager`, `participant` — see `001_auth.sql`.

## When adding columns

1. New file `supabase/migrations/0xx_name.sql`
2. Update `specs/global/database.md`
3. Update this ER if relationships change
4. Update Zod / `mapFormToDb` / compare snapshots as needed
5. Never edit applied migrations on shared environments
