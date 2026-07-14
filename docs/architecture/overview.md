# Architecture overview

Linked specs: all of [`specs/INDEX.md`](../../specs/INDEX.md).

## System context

```mermaid
C4Context
  title CFCA Registration — system context
  Person(guest, "Guest registrant", "Registers without account")
  Person(participant, "Participant", "Logged-in registrant")
  Person(staff, "Staff / manager", "Dashboard, reconcile, users")
  System(app, "CFCA Registration", "Next.js app")
  System_Ext(supabase, "Supabase Postgres", "Data + storage")
  System_Ext(resend, "Resend", "Transactional email")
  System_Ext(bank, "Bank transfer", "Human pays offline")
  Rel(guest, app, "Uses / register")
  Rel(participant, app, "My registration, payment")
  Rel(staff, app, "Dashboard APIs")
  Rel(app, supabase, "Service role SQL")
  Rel(app, resend, "Send mail")
  Rel(participant, bank, "Pays with Unique Code")
  Rel(staff, bank, "PDF statement reconcile")
```

## Containers

```mermaid
flowchart TB
  subgraph Browser
    UI[React pages / components]
  end
  subgraph Next["Next.js 16 App Router"]
    Proxy[src/proxy.ts]
    Pages[app/*/page.tsx]
    API[app/api/*/route.ts]
    Lib[src/lib domain]
  end
  subgraph Data
    PG[(Postgres)]
    Storage[Bank PDF storage]
  end
  UI --> Pages
  UI --> API
  Pages --> Proxy
  API --> Lib
  Lib --> PG
  Lib --> Storage
  Lib --> Resend[Resend]
```

## Domain mind map

```mermaid
mindmap
  root((Code domains))
    auth
      JWT access
      Refresh tokens
      Permissions groups
      Middleware
    registrations
      Schema Zod
      Service mapFormToDb
      Compare no-op
      Souvenirs
      View tokens
    payments
      Unique Code
      Reconcile PDF
      Manual admin update
    audit
      writeAuditLog
      Dashboard audit UI
    email
      Registration + payment mails
    dashboard
      List cache
      Filters paging
```

## Request path (typical authenticated API)

```mermaid
sequenceDiagram
  participant B as Browser
  participant M as Middleware
  participant P as Page/API
  participant A as lib/auth
  participant D as Postgres
  B->>M: Request cookie access token
  alt Protected page, no/invalid access
    M->>B: Redirect /login?redirect=
  else OK or public
    M->>P: Continue
    P->>A: requireAuth / authFetch
    A->>D: Optional refresh / queries
    P->>B: HTML or JSON
  end
```

## Design principles used here

1. **Spec-first** product changes (`specs/` then code).
2. **Authorization in API** (service-role Supabase; RLS disabled on app tables).
3. **Audit sensitive mutations** (`audit_log`).
4. **Unique Code** for payment matching (`participant_reference`).
5. **No-op saves skipped** (client + server) to avoid empty audits.

## Where to go next

- [folder-map.md](./folder-map.md) — find files fast  
- [tech-stack.md](./tech-stack.md) — runtime details  
- [../data/model.md](../data/model.md) — tables  
