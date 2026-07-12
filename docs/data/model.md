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
  registrations ||--o{ payments : receives
  users ||--o{ payments : created_by
  users ||--o{ registration_admin_notes : authored
  users ||--o{ audit_log : actor
  bank_statements ||--o{ bank_transactions : contains
  bank_statements ||--o{ payments : reconcile_source
  registrations ||--o{ bank_transactions : matched

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
    jsonb souvenir_orders
    payment_source payment_last_updated_source
  }
  payments {
    uuid id PK
    uuid registration_id FK
    numeric amount
    payment_source source
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
| `view_token_hash` / signup tokens | Magic link + account link |

## Groups (seeded)

`admin`, `registration_manager`, `accommodation_manager`, `participant` — see `001_auth.sql`.

## When adding columns

1. New file `supabase/migrations/0xx_name.sql`
2. Update `specs/global/database.md`
3. Update this ER if relationships change
4. Update Zod / `mapFormToDb` / compare snapshots as needed
5. Never edit applied migrations on shared environments
