# Registration flows

Specs: `features.registration`, `features.registration-complete`, `features.magic-link-view`, `features.home`.

## Continuous form (guest)

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
  Form->>G: /register/complete?...
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
      Form->>P: /my-registration
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
  Fees[Conference fees pricing/calculate]
  Souvenir[T-shirts $30 × qty souvenirs.ts]
  Fees --> Total[amount_due]
  Souvenir --> Total
```

## Key files

| Concern | Path |
|---------|------|
| UI | `src/components/registrations/registration-form.tsx` |
| Zod | `src/lib/registrations/schema.ts` |
| Persist | `src/lib/registrations/service.ts` |
| No-op detect | `src/lib/registrations/compare.ts` |
| Public/auth POST | `src/app/api/registrations/route.ts` |

## Debug tips

- Email already used → `EMAIL_IN_USE` + Login link
- Amount wrong → check early bird slot + souvenir_orders JSON
- Empty audits → ensure no-op path; see compare + PUT early return
