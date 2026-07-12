# System documentation (engineering handbook)

Welcome. This handbook helps **junior and senior** engineers understand, maintain, and extend the CFCA Registration system.

## How this relates to specs

| Layer | Location | Purpose |
|-------|----------|---------|
| **Product behavior** (what the system should do) | [`specs/`](../specs/) | Source of truth for features & acceptance criteria |
| **Engineering handbook** (how the system is built & operated) | [`docs/`](./) | Architecture, flows, debugging, contributing |

**Rule:** Product “what” lives in specs. System “how / where / why” lives here. When either drifts from code, fix it in the same change set.

See [`_meta/SYNC-WITH-SPECS.md`](./_meta/SYNC-WITH-SPECS.md).

## Start here by role

| You are… | Read first |
|----------|------------|
| New joiner (any level) | [Onboarding](./onboarding/01-welcome.md) → [Architecture overview](./architecture/overview.md) |
| Junior implementing a ticket | [Add a feature](./contributing/add-a-feature.md) + matching `specs/features/*` |
| Debugging production/local | [Debugging playbook](./operations/debugging.md) |
| Senior reviewing design | [Architecture](./architecture/overview.md), [Data model](./data/model.md), [Flows](./flows/) |

## Catalog

Full index: **[INDEX.md](./INDEX.md)**

### Quick links

- [Mind map & system context](./architecture/overview.md)
- [More mind maps](./architecture/mind-maps.md)
- [Folder map](./architecture/folder-map.md)
- [Auth sequence](./flows/auth.md)
- [Registration sequence](./flows/registration.md)
- [Payment & reconcile](./flows/payment.md)
- [Admin dashboard](./flows/admin-dashboard.md)
- [Data model (ER)](./data/model.md)
- [Data flow](./data/data-flow.md)
- [Local development](./operations/local-dev.md)
- [Migrations](./operations/migrations.md)
- [Fix a bug](./contributing/fix-a-bug.md)
- [Code conventions](./contributing/code-conventions.md)

## Keeping docs in sync

1. Behavior change → update **spec** first, then **code**, then update any **flow/architecture** doc that describes that area.
2. After commit: `npm run specs:stamp` (specs) and ensure docs `synced_at` / notes are current (see sync protocol).
3. Cursor agents must follow [`.cursor/rules/system-documentation.mdc`](../.cursor/rules/system-documentation.mdc).
