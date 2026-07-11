<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:spec-driven -->
# Spec-driven development

- Product behavior is defined in `specs/` ([INDEX](specs/INDEX.md), [README](specs/README.md), [SYNC-PROTOCOL](specs/_meta/SYNC-PROTOCOL.md)).
- Before changing features: read the matching spec; update the spec when behavior changes; keep `files` and `synced_commit` accurate.
- If code was changed without a spec update: update the spec to match.
- Stamp hashes after commit: `npm run specs:stamp`.
<!-- END:spec-driven -->
