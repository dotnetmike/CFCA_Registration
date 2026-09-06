# Email providers (Resend / Microsoft 365 Graph)

Outbound mail goes through `src/lib/email/provider.ts`. Templates stay the same; only the transport changes.

## Switch providers

| Variable | Values | Default |
|----------|--------|---------|
| `EMAIL_PROVIDER` | `resend` \| `office365` | `resend` |

Aliases accepted for Office 365: `o365`, `microsoft`.

## Resend (default)

| Variable | Required | Notes |
|----------|----------|-------|
| `RESEND_API_KEY` | Yes (to actually send) | From Resend dashboard |
| `EMAIL_FROM` | Recommended | **Resend only.** From header, e.g. `CFCA Registration <noreply@yourdomain.com>` — **do not** wrap in extra quotes. Must be a verified domain/sender in Resend |

If `RESEND_API_KEY` is empty while provider is `resend`, the app logs the email to the console and continues (local/dev behavior).

## Microsoft 365 via Microsoft Graph (OAuth app)

Works with **Security Defaults enabled**. Does **not** use SMTP username/password or app passwords.

| Variable | Required | Notes |
|----------|----------|-------|
| `OFFICE365_TENANT_ID` | Yes | Entra Directory (tenant) ID |
| `OFFICE365_CLIENT_ID` | Yes | App registration Application (client) ID |
| `OFFICE365_CLIENT_SECRET` | Yes | App client secret value |
| `OFFICE365_USERNAME` | Yes | Mailbox UPN to send **as** (also the From address). Alias: `OFFICE365_EMAIL` |
| `OFFICE365_FROM_NAME` | Recommended | Friendly From display name (e.g. `CFCA National Conference 2026`). If unset, tries Entra `displayName`, then `CFCA Registration` |

Aliases also accepted: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

`EMAIL_FROM` is **ignored** when `EMAIL_PROVIDER=office365`. From is `OFFICE365_FROM_NAME <OFFICE365_USERNAME>` (MIME send so clients show the display name).

### Entra admin setup (one-time)

1. Open [Microsoft Entra admin center](https://entra.microsoft.com) → **Identity** → **Applications** → **App registrations** → **New registration**
2. Name e.g. `CFCA Registration Email`, accounts in this org only → **Register**
3. Copy **Application (client) ID** → `OFFICE365_CLIENT_ID`
4. Copy **Directory (tenant) ID** → `OFFICE365_TENANT_ID`
5. **Certificates & secrets** → **New client secret** → copy the **Value** once → `OFFICE365_CLIENT_SECRET`
6. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions** → add **`Mail.Send`**
7. Click **Grant admin consent for \<tenant\>** (required)
8. Set `OFFICE365_USERNAME` to the licensed mailbox that should appear as sender (e.g. `admin@cfcanatcon.com` or a dedicated `noreply@…`)

The app sends with application permissions as that user via:

`POST /v1.0/users/{OFFICE365_USERNAME}/sendMail`

No Security Defaults change is required.

### Example `.env` (Office 365 Graph)

```bash
EMAIL_PROVIDER=office365
OFFICE365_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OFFICE365_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OFFICE365_CLIENT_SECRET=your-client-secret
OFFICE365_USERNAME=admin@cfcanatcon.com
OFFICE365_FROM_NAME=CFCA National Conference 2026
# EMAIL_FROM is ignored for Office 365
```

### Example `.env` (Resend — default)

```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=CFCA Registration <noreply@yourdomain.com>
```

## Local / Vercel

- Put the keys in `.env.dev` / `.env.uat` / `.env.production` (and matching Vercel env scopes) for the branch you run.
- On `master`, edit `.env.production` then restart `npm run dev` (runs `env:select`).
- Never commit client secrets.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Console-only “dev” send | Missing Graph env vars or `RESEND_API_KEY` |
| Token acquire failed | Wrong tenant/client/secret; secret expired |
| `Authorization_RequestDenied` / 403 | `Mail.Send` application permission missing or admin consent not granted |
| 404 on sendMail | `OFFICE365_USERNAME` is not a real mailbox UPN |
| Still seeing `send.cfcanorth.online` | App is still on Resend — confirm `EMAIL_PROVIDER=office365` in the **branch** env file loaded by `env:select` |
| Old SMTP `535 security defaults` | Legacy password SMTP removed; use Graph vars above |

## Related

- Spec: [`specs/global/email.md`](../../specs/global/email.md)
- [Environments](./environments.md)
- [Debugging](./debugging.md)
