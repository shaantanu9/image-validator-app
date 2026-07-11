# Client Route Protection & Auth Flow

How the Next.js client protects routes, and how that fits the end-to-end auth flow. Protection is **two layers on the client plus the real boundary on the server**.

## The three layers

| Layer | Where | What it does | Is it the security boundary? |
|---|---|---|---|
| 1. **Edge middleware** | `client/src/middleware.ts` | Reads a session cookie and redirects **before any page renders** — unauthenticated users off `/dashboard` `/profile`, authenticated users off `/login` `/register` | No — a fast UX/routing gate |
| 2. **Client guard** | `(protected)/layout.tsx` + `hooks/useRequireAuth.ts` | After hydration, re-checks the store and redirects; renders a spinner while resolving. Catches mid-session expiry / cross-tab logout | No — defence in depth |
| 3. **API auth** | server `middlewares/authMiddleware.ts` | Verifies the JWT **signature** on every request and attaches the caller's own `userId` to `req.user`; every protected route acts solely on that id — never on a client-supplied one | **Yes — the real boundary** |

> **Key principle:** the client cannot securely authenticate a client-held JWT. Layers 1–2 are UX (keep the wrong people off the wrong screens instantly); layer 3 is where security actually happens. Every protected screen's data comes from an API call that re-verifies the token.
>
> There is no role/privilege concept in this app. There is no user directory and no cross-user read/write path at all — `GET/PATCH/DELETE /auth/me` only ever operate on the id embedded in the verified JWT, so authorization reduces to "authenticated, and acting on your own record."

## Why a cookie (the missing piece)

The access token lives in `localStorage` (Zustand `persist`). **Next.js edge middleware runs on the server and can only read cookies, not `localStorage`.** So the client mirrors a session-presence signal into a cookie the edge can read:

- `lib/authCookie.ts` — `setAuthCookie(token)` / `clearAuthCookie()` (name `access_token`, `SameSite=Lax`, `Secure` in prod, 7-day max-age so it survives short access-token expiry).
- `components/common/AuthCookieSync.tsx` — mounted once in the root layout; subscribes to the store and writes/clears the cookie whenever the access token changes (login sets it, logout clears it).

The cookie is **non-httpOnly** — it only mirrors the token already exposed to JS in `localStorage`, so it adds no new XSS surface. For maximum hardening, move to **server-set httpOnly cookies** (see the upgrade path at the bottom).

## End-to-end flow

```
Browser navigates to /dashboard
        │
        ▼
┌──────────────────────────┐   no access_token cookie
│  middleware.ts (edge)    │ ───────────────────────────▶ 302 /login?redirect=/dashboard
│  reads access_token      │
└───────────┬──────────────┘   cookie present
            ▼
┌──────────────────────────┐   store hydrated & !isAuthenticated
│ (protected)/layout.tsx   │ ───────────────────────────▶ router.replace(/login)
│ useRequireAuth()         │
└───────────┬──────────────┘   authenticated
            ▼
     Protected page renders
            │  fetch via lib/api.ts (Authorization: Bearer <access token>)
            ▼
┌──────────────────────────┐   invalid/expired signature
│ server authMiddleware    │ ───────────────────────────▶ 401 → axios single-flight refresh
│ verifyAccessToken()      │                                  (rotates refresh token) → retry
│ scopes to req.user.userId│
└──────────────────────────┘   valid → data
```

**Login round-trip:** submit → `authStore.login()` → API issues access + rotating refresh tokens → store updates → `AuthCookieSync` writes the cookie → `login/page.tsx` honours `?redirect=` (safe internal paths only — no open redirect) and pushes the user to their intended page.

**Logout:** `authStore.logout()` clears tokens → `AuthCookieSync` clears the cookie → middleware now treats the user as unauthenticated.

## Files

| File | Purpose |
|---|---|
| `client/src/middleware.ts` | Edge gate (`config.matcher`: `/dashboard/*`, `/profile/*`, `/login`, `/register`) |
| `client/src/lib/authCookie.ts` | Set/clear the edge-readable session cookie |
| `client/src/components/common/AuthCookieSync.tsx` | Keeps the cookie synced with the store |
| `client/src/app/(protected)/layout.tsx` | Client guard wrapping all protected pages |
| `client/src/hooks/useRequireAuth.ts` | Post-hydration redirect logic (layer 2) |
| `client/src/app/(auth)/login/page.tsx` | Post-login `?redirect=` handling |

## Adding a new protected route

1. Put the page under `client/src/app/(protected)/`.
2. Add its path prefix to `PROTECTED_PREFIXES` in `middleware.ts`.
3. Add it to the middleware `config.matcher`.

That's it — the `(protected)` layout guard applies automatically.

## How it's tested

- **Integration** (`client/tests/middleware.test.ts`): builds real `NextRequest`s (with/without the cookie) and asserts the real `NextResponse` for all six cases — unauthenticated redirects (incl. nested paths + the `redirect=` param), authenticated pass-through, and the logged-in→`/login` bounce.
- **Cookie helper** (`client/tests/lib/authCookie.test.ts`): set/clear behaviour.
- **E2E** (`e2e/protected.test.ts`): a real browser hitting `/dashboard` and `/profile` while logged out lands on `/login`.

Run: `pnpm --filter client test` (integration) · `pnpm test:e2e` (end-to-end).

## Upgrade path — httpOnly cookies (maximum hardening)

The current model keeps the token client-side (localStorage + mirrored cookie). To make the cookie the sole, XSS-safe token store:

1. Have the **server** set the refresh (and optionally access) token as `httpOnly; Secure; SameSite=Strict` cookies on login/refresh.
2. Add a Next.js rewrite `'/api/:path*' → <API origin>` (see the note in `next.config.js`) so requests are same-origin and the cookie is sent automatically.
3. Point `lib/api.ts` `baseURL` at `/api/v1` and set `withCredentials: true`; drop the `Authorization` header injection.
4. `middleware.ts` then reads the httpOnly cookie exactly as it does today (no change to the gate logic).

This removes `localStorage` token storage entirely while keeping the same middleware.
