# Payment & reconcile flows

Specs: `features.payment`, `features.dashboard` (reconcile + admin payment).

## Participant payment info

```mermaid
sequenceDiagram
  actor P as Participant
  participant Pay as /payment
  participant API as GET /api/registrations
  P->>Pay: open
  Pay->>API: authFetch
  API-->>Pay: registration
  Note over Pay: Unique Code, due, paid, remaining balance
  Pay->>P: Bank details + How to Pay mockup
```

Participant pays **outside** the app via bank transfer using the Unique Code in Message and Ref.

## Admin manual payment update

```mermaid
sequenceDiagram
  actor S as Staff
  participant UI as Registration detail
  participant API as PATCH .../payment
  participant DB as Postgres
  S->>UI: set amount_paid + status
  alt unchanged
    UI-->>S: No payment changes
  else
    UI->>API: PATCH
    API->>DB: payments row source=manual
    API->>DB: registration attribution + amounts
    API->>DB: audit payment.manual_update
    API-->>UI: updated registration
  end
```

Attribution fields: `payment_last_updated_source` (`manual` | `bank_reconcile`), `payment_last_updated_at`, `payment_last_updated_by`.

## Bank PDF reconcile

```mermaid
sequenceDiagram
  actor S as Staff
  participant UI as /dashboard/payments/reconcile
  participant API as POST /api/payments/reconcile
  participant Store as Storage
  participant Parse as parseBankPdf
  participant DB as Postgres
  S->>UI: upload PDF
  UI->>API: multipart
  API->>Store: bank-statements/...
  API->>Parse: extract txns + refs
  loop each transaction
    API->>DB: match registration_no or participant_reference
    alt amount >= amount_due and new
      API->>DB: insert payments bank_reconcile
      API->>DB: update amount_paid / status + attribution
      API->>DB: audit + email payment_received
    end
    API->>DB: bank_transactions matched/unmatched
  end
  API-->>UI: results summary
```

## Debug tips

- Payment not matched → Unique Code vs registration_no in statement text; amount threshold
- Remaining balance = `max(0, amount_due - amount_paid)`
- Permission: `payments:reconcile` for reconcile + typically `registrations:write_all` for manual updates
