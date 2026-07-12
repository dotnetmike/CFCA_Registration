# Data flow

## Registration create (guest) — data movement

```mermaid
flowchart LR
  Form[Form values] --> Zod[registrationSchema]
  Zod --> Map[mapFormToDb]
  Map --> Reg[(registrations)]
  Form --> Att[attendees array]
  Att --> AttT[(registration_attendees)]
  Map --> Due[amount_due fees + souvenirs]
  Reg --> Mail[email payload]
  Reg --> Tokens[view/signup token hashes]
```

## Payment status lifecycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> partial: partial payment
  pending --> paid: full payment
  partial --> paid: completes
  paid --> overpaid: amount_paid > amount_due
  partial --> overpaid: overpay
```

Sources of truth updates: reconcile (`bank_reconcile`) or admin PATCH (`manual`).

## Audit data flow

```mermaid
flowchart TB
  Mut[API mutation]
  Snap[pick previous/updated]
  San[sanitizeAuditValue]
  Ins[(audit_log)]
  Mut --> Snap --> San --> Ins
```

Sensitive keys redacted (`password_hash`, tokens, etc.).

## Dashboard list cache flow

```mermaid
flowchart TB
  API[GET registrations *] --> Slim[slim rows no attendees blob]
  Slim --> Mem[memory cache]
  Slim --> Sess[sessionStorage if small]
  Mem --> UI[Filters then page]
  Sess --> Mem
```

Cap / TTL: see `src/lib/dashboard/registrations-list-cache.ts`.
