# Admin dashboard flows

Specs: `features.dashboard`, `features.audit`.

## List + filters + paging

```mermaid
flowchart TB
  Fetch[GET /api/registrations]
  Cache[Client cache slim rows TTL]
  Filter[Filter full set]
  Page[Slice 100 / page]
  Fetch --> Cache
  Cache --> Filter
  Filter --> Page
  Refresh[Refresh button] -->|clear + refetch| Fetch
```

Filters (full dataset): payment, accommodation, transpo, state, souvenir pre-order, text search.

## Registration detail

```mermaid
stateDiagram-v2
  [*] --> ReadOnly
  ReadOnly --> Editing: Edit + warning
  Editing --> ReadOnly: Cancel remount
  Editing --> Confirm: Save
  Confirm --> ReadOnly: OK after PUT
  Confirm --> Editing: User cancels confirm
```

Sections: Registration Info → Payment → Attendees → Accommodation → Transportation → **Admin notes** (bottom).

## Audit log

```mermaid
flowchart LR
  Action[Mutation] --> Write[writeAuditLog]
  Write --> Table[(audit_log)]
  Table --> UI[/dashboard/audit]
```

Empty registration updates should **not** write rows (no-op guards).

## Permissions cheat sheet

| Capability | Typical permission |
|------------|-------------------|
| See dashboard | manager group |
| Edit all registration fields | `registrations:write_all` |
| Edit accommodation/transport | `accommodation:write_all` |
| Reconcile / manual payment | `payments:reconcile` (and/or write_all) |
| Users + audit UI | `users:manage` |

## Navigation submenu

```mermaid
flowchart LR
  Header[Header Dashboard dropdown]
  Subnav[DashboardSubnav on /dashboard pages]
  Header --> Reg[/dashboard]
  Header --> Reports[/dashboard/reports]
  Header --> Recon[/dashboard/payments/reconcile]
  Header --> Users[/dashboard/users]
  Header --> Audit[/dashboard/audit]
  Subnav --> Reg
  Subnav --> Reports
  Subnav --> Recon
  Subnav --> Users
  Subnav --> Audit
```

Role editor: Users page → Edit roles → `PATCH /api/admin/users` → audit `user.update` + revoke sessions.

## Key files

- `src/components/layout/dashboard-subnav.tsx`
- `src/components/layout/site-header.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/users/page.tsx`
- `src/lib/auth/user-groups.ts`
- `src/lib/dashboard/registrations-list-cache.ts`
- `src/app/dashboard/registrations/[id]/page.tsx`
- `src/app/dashboard/audit/page.tsx`
