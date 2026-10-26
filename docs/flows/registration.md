# Registration flows

Specs: `features.registration`, `features.registration-complete`, `features.registration-workflow-v2`, `features.magic-link-view`, `features.home`.

## Continuous form (guest)

Workflow comes from Dashboard Settings (`registration_workflow`, default **v1**). Preview V2 without flipping Settings: `/?workflow=v2`.

```mermaid
sequenceDiagram
  actor G as Guest
  participant Form as / RegistrationForm
  participant Check as GET check-email
  participant API as POST /api/registrations
  participant DB as Postgres
  participant Mail as Resend
  G->>Form: Fill sections 1–5 + Submit
  Form->>Check: blur/submit email unique
  Form->>API: submit true + payload
  API->>DB: insert registration + attendees
  API->>DB: tokens, Unique Code, amount_due
  API->>Mail: confirmation + magic link
  API-->>Form: signupToken, viewToken
  alt V1 classic
    Form->>G: /register/complete
  else V2 online capability
    Form->>G: /register/pay then complete
  end
```

## Logged-in update

```mermaid
sequenceDiagram
  actor P as Participant
  participant Form as RegistrationForm
  participant API as PUT /api/registrations/id
  participant Cmp as compare.ts
  participant DB as Postgres
  P->>Form: Submit Changes
  alt no field changes
    Form-->>P: No changes to save
  else has changes
    Form->>API: PUT
    API->>Cmp: snapshot before/after
    alt unchanged server-side
      API-->>Form: unchanged true
    else
      API->>DB: update + attendees
      API->>DB: audit registration.update
      API-->>Form: registration
      Form->>P: /my-registration or /payment when V2 balance due
    end
  end
```

## Magic link view

```mermaid
flowchart LR
  Email[Confirmation email] -->|/r/token| View[Read-only page]
  View -->|Edit| LoginOrSignup{Has account?}
  LoginOrSignup -->|yes| Login[/login]
  LoginOrSignup -->|no| Signup[/signup?email=]
  View -->|Balance due > 0| Pay[/register/pay?view=token]
  Pay -->|Stripe success / bank continue| View
```

## Update notification email

```mermaid
sequenceDiagram
  actor S as Staff / participant save
  participant API as PUT /api/registrations/id
  participant Mail as registration_updated email
  actor P as Participant
  participant Portal as /my-registration
  S->>API: save changes
  API->>Mail: full details + portal link
  Mail->>P: email with accommodation/transpo contacts
  P->>Portal: click link
  alt not logged in
    Portal-->>P: /login?redirect=/my-registration
  end
  P->>Portal: after login see registration
```

## Amount due composition

```mermaid
flowchart TB
  Claim[assignEarlyBird early-bird-claim.ts]
  Fees[Conference fees pricing/calculate]
  Souvenir[T-shirts $30 × qty souvenirs.ts]
  Claim -->|slot + adult limit| Fees
  Fees --> Total[amount_due]
  Souvenir --> Total
```

## Early bird claim (submit / edit)

Rules: `features.registration` → "Early bird is per adult". Runs in `POST /api/registrations` (submit) and `PUT /api/registrations/[id]` (first submit, or edit of a registration that already has early bird).

```mermaid
flowchart TB
  Start[adults = registrant + spouse + attendees 18+] --> Kept[kept = min existing early-bird adults, adults]
  Kept --> Open{Claim open today?<br/>Melbourne day, start..min end, due}
  Open -->|no| Limit[limit = kept]
  Open -->|yes, wants more| Pool[load paid adults of other registrations in pool]
  Pool -->|load failed| Limit
  Pool --> Room[limit = min adults, max kept, cap − paid by others]
  Room --> Col{early_bird_adult_limit column exists?}
  Limit --> Col
  Col -->|yes| Save[save slot + limit, first limit adults at the early-bird rate]
  Col -->|no, before migration 028| Legacy[keep previous all-or-nothing slot]
```

Unpaid early-bird adults are later moved to the regular rate by the daily cron (`docs/flows/payment.md` → Daily payment reminders and early-bird expiry).

## Key files

| Concern | Path |
|---------|------|
| UI | `src/components/registrations/registration-form.tsx` |
| Zod | `src/lib/registrations/schema.ts` |
| Persist | `src/lib/registrations/service.ts` |
| No-op detect | `src/lib/registrations/compare.ts` |
| Public/auth POST | `src/app/api/registrations/route.ts` |
| Early bird counting / dates / wording | `src/lib/pricing/early-bird.ts` |
| Early bird claim | `src/lib/registrations/early-bird-claim.ts` |
| Early bird expiry | `src/lib/registrations/early-bird-expiry.ts`, `early-bird-expiry-runner.ts` |

## Debug tips

- Email already used → `EMAIL_IN_USE` + Login link
- Amount wrong → check `is_early_bird`, `early_bird_slot`, `early_bird_adult_limit` (adults on early bird; `NULL` = all), attendee ages and souvenir_orders JSON
- Early bird missing on a new registration → pool full of paid adults, or submitted after the claim end date (Melbourne day)
- Empty audits → ensure no-op path; see compare + PUT early return
