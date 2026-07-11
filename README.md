# Image Validator

> TODO: one paragraph — the problem this solves, and the shape of your solution.

## Stack

- **Client** — Next.js 15 (App Router), Tailwind, Zustand
- **API** — Express + TypeScript, layered `routes → controllers → services → repositories`
- **Database** — PostgreSQL via Prisma, Redis for rate limiting and refresh tokens
- **Auth** — JWT access tokens + rotating refresh tokens; no roles — every route acts only on the caller's own record

## Run it

```bash
pnpm install
pnpm db:up
cp server/.env.example server/.env
cp client/.env.example client/.env.local
pnpm --filter server db:deploy           # apply Prisma migrations
pnpm --filter server db:seed             # seed the demo user
pnpm dev
```

Client on :3100, API on :5012.

The background worker is a separate process — jobs sit unconsumed without it:

```bash
pnpm --filter server worker
```

## Test it

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build   # the CI gate
pnpm test:api                                          # Bruno contract tests
pnpm test:e2e                                          # Puppeteer
```

## Scope

> TODO: what you built, what you deliberately left out, and why.

## Notes

> TODO: trade-offs, known limitations, what you'd do with more time.

See `CONTRIBUTING.md` for conventions.
