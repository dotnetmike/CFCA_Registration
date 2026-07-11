# Spec ↔ code sync protocol

## Principle

**Specs and code must always agree.** If they diverge, fix the divergence in the same change set (or immediately after discovering it).

## Direction of sync

| Situation | Action |
|-----------|--------|
| Product / UX / behavior change requested | Update **spec first**, then **code** |
| Code was edited without a spec update | Update **spec** to match code (behavior + `files`) |
| Spec outdated vs working tree | Diff listed `files`, update spec sections, stamp commit when committing |
| New feature | New spec from TEMPLATE → INDEX entry → implement |

## Commit hash (`synced_commit`)

Each product spec includes:

```yaml
synced_commit: abc1234   # short SHA
synced_at: 2026-07-11
```

Meaning: “This spec was verified against the code as of that commit.”

| Value | When to use |
|-------|-------------|
| Short SHA (`b13ac5b`) | After a commit that includes matching code + spec |
| `working-tree` | Local uncommitted work; replace with SHA on commit |

### Stamping after commit

```bash
npm run specs:stamp
```

Updates `synced_commit` / `synced_at` on all specs under `specs/global` and `specs/features` to `HEAD`.

Prefer stamping in the same PR as the feature, or as a follow-up commit `docs(specs): stamp synced_commit`.

## File lists

The `files:` array is the ownership boundary:

- Cursor should treat those paths as in-scope for that spec.
- If you add/remove/rename a source file for the feature, update `files`.
- Shared utilities may appear in multiple specs; document primary owner in Notes.

## PR checklist

- [ ] Spec(s) updated (or new spec + INDEX row)
- [ ] Code matches acceptance criteria
- [ ] `files` list accurate
- [ ] `synced_commit` is `working-tree` or stamped to this branch’s commit
- [ ] No contradictory statements vs related global specs

## Cursor prompts (examples)

- “Read `specs/features/registration.md` and implement the missing acceptance criteria.”
- “I changed the payment page manually — update the payment spec to match.”
- “Sync specs with code for auth; stamp after.”
- “Add a new feature spec for X using the template.”
