# Scaffold Image Validator — Next.js + Express + Postgres

**Date:** 2026-07-11
**Type:** Infrastructure

## Summary

Generated the `image_validator` monorepo from the `fullstack-ts-scaffold` skill: a Next.js 15 client
and a single Express backend on Postgres/Prisma, with Redis, JWT auth (rotating refresh tokens),
Zod validation, Swagger, Vitest, a Bruno API collection, Puppeteer e2e, and GitHub Actions CI.
Ports were remapped (API 5012, client 3100) because another local project already held :3000.

Three defects in the scaffold's `--only sql` path had to be fixed before the repo was usable; all
three were also fixed upstream in the skill itself.

## Changes

- Scaffolded the repo with `--only sql --api-port 5012 --client-port 3100` (Postgres/Prisma only).
- Fixed the Prisma client generation and database migrations, which the scaffold reported as PASS
  but had never actually run (`pnpm` exits 0 on an unmatched `--filter`, and the workspace had been
  renamed `server-sql` → `server`).
- Created and migrated both the dev (`image_validator_db`) and test (`image_validator_test`) databases.
- Fixed the root `test:api` script, which was self-referential (`"test:api": "pnpm test:api"`).
- Verified the full gate green: server lint / type-check / 123 tests / build, client lint /
  type-check / 33 tests / build, and the Bruno contract suite (9 requests, 18 tests).

## Files Created

- `changelogs/2026-07-11_01_scaffold-nextjs-express-postgres.md`

## Files Modified

- `package.json` — `test:api` now runs the Bruno collection instead of calling itself.
