# Remove role-based access control — every account is a plain user

**Date:** 2026-07-11
**Type:** Refactor

## Summary

Removed RBAC entirely. There is no longer any role, privilege, or admin concept: no `USER`/`ADMIN`/
`MODERATOR`, no `role` column, no `requireRole` middleware, no admin seed. Every account is a plain
user.

The admin-only user directory (`GET /users`, `GET /users/:id`, `PATCH /users/:id`,
`DELETE /users/:id`, `GET /users/stats`) was **deleted** rather than opened up — un-gating it would
have let any authenticated user enumerate every account. Self-service moved to `/auth/me`, whose
handlers resolve their subject solely from the verified JWT and never from a client-supplied id, so
there is no cross-user read or write path left to reach.

Prisma migration history was squashed: the template's `20260707192741_init_test` migration and the
role-drop delta were replaced by a single fresh `20260711055844_init` generated from the current
schema.

## Changes

- Deleted the `Role` enum, the `role` column, `constants/roles.ts`, and `requireRole`.
- Deleted the entire `/users` router, its controller, and the stats controller/service.
- Added self-service `PATCH /auth/me` (own name) and `DELETE /auth/me` (own account);
  `GET /auth/me` now returns the persisted record rather than echoing the token payload.
- `updateUserSchema` accepts only `name`, so a smuggled `role`/`isActive` is stripped, not persisted
  (mass-assignment guard, covered by tests).
- Removed the `AUTHZ_DENIED` audit event, dead once `requireRole` was gone.
- Squashed migrations into a single `20260711055844_init`; reseeded a plain `demo@example.com`
  (`Demo@123456`) in place of the admin seed.
- Rewrote the client, Bruno collection, e2e suite, and docs (incl. the SOC 2 matrix in
  `docs/COMPLIANCE.md`, which had claimed role-based least-privilege) to match.

## Files Created

- `server/src/database/prisma/migrations/20260711055844_init/migration.sql`
- `server/tests/integration/me.test.ts`
- `bruno/Image Validator API/Auth/Update Me.bru`, `.../Delete Me.bru`

## Files Modified

- `server/src/`: `types/user.ts`, `types/api.ts`, `utils/jwt.ts`, `utils/audit.ts`,
  `middlewares/authMiddleware.ts`, `routes/auth.routes.ts`, `routes/index.ts`,
  `controllers/auth.controller.ts`, `services/auth.service.ts`, `services/user.service.ts`,
  `validations/user.schema.ts`, `database/repositories/*`, `database/prisma/{schema.prisma,seed.ts}`,
  `docs/openapi.ts`
- `server/tests/`: `unit/middlewares/authMiddleware.test.ts`, `unit/utils/jwt.test.ts`,
  `unit/utils/audit.test.ts`, `unit/validations/user.schema.test.ts`,
  `unit/repositories/prisma.user.repository.test.ts`, `unit/services/user.service.test.ts`
- `client/src/`: `types/auth.ts`, `types/next-auth.d.ts`, `auth.ts`, `auth.config.ts`,
  `hooks/useAuth.ts`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/profile/page.tsx`
- `e2e/auth.test.ts`, `README.md`, `CONTRIBUTING.md`, `docs/COMPLIANCE.md`,
  `docs/ROUTE_PROTECTION.md`, `.github/workflows/ci.yml`

## Files Deleted

- `server/src/constants/roles.ts`, `controllers/user.controller.ts`, `controllers/stats.controller.ts`,
  `services/stats.service.ts`, `routes/user.routes.ts`
- `server/tests/integration/users.test.ts`, `server/tests/unit/services/stats.service.test.ts`
- `client/src/constants/roles.ts`
- `bruno/Image Validator API/Users/` (whole folder), `.../Auth/Login Admin.bru`
- `server/src/database/prisma/migrations/20260707192741_init_test/`
