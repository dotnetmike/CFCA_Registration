# Auth flows

Specs: `global.auth-security`, `features.login`, `features.signup`, `features.password-reset`, `features.account`.

## Roles

```mermaid
flowchart TB
  subgraph Groups
    admin[admin]
    rm[registration_manager]
    am[accommodation_manager]
    p[participant]
  end
  Managers[isManager]
  admin --> Managers
  rm --> Managers
  am --> Managers
  p --> ParticipantUX[My registration / Payment]
  Managers --> Dashboard[/dashboard]
```

## Login sequence

```mermaid
sequenceDiagram
  actor U as User
  participant L as /login
  participant API as POST /api/auth/login
  participant DB as Postgres
  U->>L: email + password
  L->>API: credentials
  API->>DB: verify user + hash
  alt invalid
    API-->>L: error + audit login_failed
  else ok
    API->>DB: create refresh_tokens row
    API-->>L: Set-Cookie access + refresh
    L->>U: redirect ?redirect= or /my-registration
  end
```

## Access token refresh

```mermaid
sequenceDiagram
  participant C as Client authFetch
  participant R as POST /api/auth/refresh
  participant DB as Postgres
  C->>R: refresh cookie
  R->>DB: validate refresh token
  R-->>C: new access (+ rotate refresh)
  Note over C: Retries original API call
```

## Account setup (post-registration only)

Cold `/signup` without linking context is blocked in UI; API requires an **unlinked registration** for the email (no draft-for-strangers).

```mermaid
sequenceDiagram
  actor G as Guest after register
  participant S as /signup?email=
  participant API as POST /api/auth/signup
  participant DB as Postgres
  G->>S: name + password
  S->>API: signup
  API->>DB: find unlinked registration by email
  alt none
    API-->>S: 400 register first
  else found
    API->>DB: create user + link registration
    API-->>S: session cookies
  end
```

## Middleware gate

Protected prefixes: `/my-registration`, `/payment`, `/dashboard`, `/account`.

Unauthenticated → `/login?redirect=<path>`.

## Debug tips

- 401 on API after login → check cookies + `JWT_SECRET` mismatch between processes
- Redirect loop → `paths.ts` / middleware matcher vs public routes
- Audit: `auth.login`, `auth.login_failed`, `auth.logout`, `auth.signup`
