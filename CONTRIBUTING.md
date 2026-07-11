# Contributing to image_validator

This is **image_validator** — a Next.js (App Router) client and an Express API on PostgreSQL + Redis. Keep it clean, typed, and tested.

## Getting started

```bash
pnpm install
pnpm db:up                                   # PostgreSQL + Redis via Docker
cp server/.env.example server/.env
cp client/.env.example client/.env.local     # set AUTH_SECRET: openssl rand -base64 33
pnpm --filter server db:deploy           # apply Prisma migrations
pnpm --filter server db:seed             # seed the admin user
pnpm dev                                     # client :3000 · server :5012
```

The root `.env.example` is a read-only reference listing every variable used in the repo.
Each service loads its own `.env`, never the root one.

## Before you open a PR

Run the full local gate — CI runs the same checks:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

## Coding standards

- **TypeScript strict**; no stray `any` (use `unknown` at boundaries, then narrow).
- **Layering (server):** `routes → controllers → services → repositories → DB`. No business logic in routes or controllers.
- **Validation:** every external input goes through a Zod schema at the boundary; infer types from the schema.
- **Formatting:** Prettier + ESLint must pass clean. Run `pnpm format` before committing.
- **No dead code, no debug `console.log`, no committed secrets.** `.env` files are gitignored — update `.env.example` when you add a variable.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/). `commitlint` runs on the
`commit-msg` hook and rejects anything else:

```
feat: add refresh-token rotation
fix: correct PORT default in env config
test: cover authMiddleware role checks
refactor: extract user pagination into service
chore: bump dependencies
docs: expand README testing section
```

Keep commits **atomic** — one logical change per commit, staged by explicit path. The git history should read as a story of how the feature was built.

## Tests

- **Unit** — services, utils, validations (Vitest).
- **Integration** — API endpoints via Supertest against real PostgreSQL + Redis.
- **API contract** — Bruno collection under `bruno/`.
- **E2E** — Puppeteer flows in `e2e/`.

New behavior needs a test. Bug fixes need a regression test.
