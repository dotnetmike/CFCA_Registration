# System mind maps

Quick visual index. Detail lives in linked pages.

## Product surface

```mermaid
mindmap
  root((Surfaces))
    Guest
      "/" registration form
      "/register/complete"
      "/r/token" magic view
      "/login" "/forgot-password"
    Participant
      "/my-registration"
      "/payment"
      "/account"
    Staff
      "/dashboard"
      "/dashboard/registrations/id"
      "/dashboard/payments/reconcile"
      "/dashboard/users"
      "/dashboard/audit"
```

## Change ownership

```mermaid
mindmap
  root((Where do I edit?))
    Behavior
      specs/features
      specs/global
    UI
      src/components
      src/app pages
    API
      src/app/api
    Domain
      src/lib
    Schema
      supabase/migrations
    Explain
      docs/flows
      docs/architecture
```

## Maintain & enhance loop

```mermaid
mindmap
  root((Team loop))
    Understand
      Onboarding
      Architecture overview
      Flow sequences
    Change
      Spec first
      Code
      Docs diagrams
    Debug
      Layer triage
      Audit log
      Network + DB
    Ship
      Version bump
      specs:stamp
```

## Deep links

| Topic | Doc |
|-------|-----|
| Context / containers | [architecture/overview.md](../architecture/overview.md) |
| Folders | [architecture/folder-map.md](../architecture/folder-map.md) |
| Auth / reg / pay / admin | [flows/](../flows/) |
| ER + data movement | [data/model.md](../data/model.md), [data/data-flow.md](../data/data-flow.md) |
| Add feature / fix bug | [contributing/](../contributing/) |
