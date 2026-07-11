# SOC 2 Readiness & Security Control Matrix

> **Scope & disclaimer.** SOC 2 is an *organizational* attestation performed by a licensed auditor over the AICPA **Trust Services Criteria (TSC)** — Security, Availability, Processing Integrity, Confidentiality, Privacy. A repository cannot "be SOC 2 certified." What a codebase *can* do is implement the **technical controls** an auditor will look for and make them **evidenceable**. This document maps the concrete controls in this repository to the TSC, marks their status, and describes how to audit them. Org-level controls (HR, vendor management, physical security, policies) are noted as **out of scope (org)**.

**Legend:** ✅ implemented in code · 🟡 partial / needs project-specific config · ⬜ out of scope for a code template (org/process control)

---

## How this maps to a take-home

A reviewer scoring a senior take-home rewards *security judgment*. This matrix is the artifact that proves it: it shows you know the difference between "I added helmet" and "here is my access-control, audit-trail, change-management, and vulnerability-management story, and here is where each lives in the code." Bring the **audit flow** (below) to the interview and you can walk any control from criterion → file → test.

---

## Common Criteria (Security — the mandatory TSC)

### CC1 — Control Environment (org)
| Control | Status | Where / how |
|---|---|---|
| Code of conduct, org structure, board oversight | ⬜ org | Policy docs outside the repo |
| Secure SDLC expectations | ✅ | `CONTRIBUTING.md` (standards, commit conventions), enforced by hooks + CI |

### CC2 — Communication & Information
| Control | Status | Where / how |
|---|---|---|
| Security policy is published & reachable | ✅ | `SECURITY.md` (disclosure policy, secret handling) |
| System/architecture documented | ✅ | `README.md` (architecture, flow, endpoints), `docs/openapi` → `/docs` |

### CC3 — Risk Assessment
| Control | Status | Where / how |
|---|---|---|
| Dependency/vulnerability risk identified | ✅ | `.github/dependabot.yml`, `security.yml` → `pnpm audit`, CodeQL |
| Threat surface documented | 🟡 | This matrix + README; project should add a short threat model |

### CC4 — Monitoring
| Control | Status | Where / how |
|---|---|---|
| Continuous control monitoring | ✅ | CI (`ci.yml`) on every push/PR; `security.yml` weekly + on PR |
| Health/observability | ✅ | `/health` (liveness) + `/ready` (DB + Redis) in `app.ts` |

### CC5 — Control Activities
| Control | Status | Where / how |
|---|---|---|
| Automated enforcement of policy | ✅ | Husky `pre-commit` (lint-staged) + `commit-msg` (commitlint); CI gates lint/typecheck/test/build |

### CC6 — Logical & Physical Access (the core security criterion)
| Control | Status | Where / how |
|---|---|---|
| Strong authentication | ✅ | JWT access + **rotating** refresh tokens, unique `jti` (`utils/jwt.ts`, `services/auth.service.ts`) |
| Credential storage | ✅ | **Argon2id** password hashing (`utils/password.ts`); only a **SHA-256 hash** of the refresh token is stored in Redis |
| Password strength policy | ✅ | Zod complexity rules (`validations/auth.schema.ts`) |
| Authorization (least privilege) | ✅ | No role/privilege concept and no user directory exist. Every protected route resolves its subject from the verified JWT (`req.user.userId` in `middlewares/authMiddleware.ts`), never from a client-supplied id — `GET/PATCH/DELETE /auth/me` can only ever read or mutate the caller's own record. |
| Session revocation | ✅ | Refresh-token revocation on logout + rotation (`services/auth.service.ts`) |
| Secrets management | ✅ | Env validated at boot (`config/env.ts`, envalid, 32-char secret floor); `.env` gitignored; gitleaks in CI |
| Transport encryption (TLS) | 🟡 | Assumed at the proxy/host; helmet HSTS ready — terminate TLS in front (documented) |
| Encryption at rest | ⬜ org | Provided by the managed DB/host (PostgreSQL/Redis at-rest encryption) |
| Rate limiting / anti-automation | ✅ | Redis-backed `express-rate-limit`, stricter on auth routes (`middlewares/rateLimiter.ts`) |
| Secure HTTP headers | ✅ | `helmet()` first in the middleware chain (`app.ts`) |
| CORS restriction | ✅ | `cors()` locked to `CLIENT_URL` in production (`app.ts`) |

### CC7 — System Operations (detection & response)
| Control | Status | Where / how |
|---|---|---|
| **Audit trail of security events** | ✅ | `utils/audit.ts` — structured audit log of login success/failure, register, logout, token refresh, self-record update/delete |
| **Request traceability / correlation IDs** | ✅ | `middlewares/requestId.ts` — `x-request-id` in/out, attached to logs |
| Structured, centralizable logging | ✅ | Winston JSON logs in prod (`utils/logger.ts`) |
| Vulnerability detection | ✅ | `security.yml` — `pnpm audit`, gitleaks, CodeQL SAST |
| Error handling without info leakage | ✅ | Central `errorHandler` — no stack traces to clients in prod |
| Incident response runbook | ⬜ org | Add project runbook; `SECURITY.md` covers intake |

### CC8 — Change Management
| Control | Status | Where / how |
|---|---|---|
| Version control + reviewable history | ✅ | Git; Conventional Commits enforced by commitlint |
| Automated pipeline gates before merge | ✅ | `ci.yml` (lint → typecheck → test → build for server + client + API/e2e) |
| Test coverage gate | ✅ | Vitest 75% threshold on server; unit + integration + API contract + e2e |
| Dependency change control | ✅ | Dependabot grouped PRs |

### CC9 — Risk Mitigation
| Control | Status | Where / how |
|---|---|---|
| Graceful degradation / shutdown | ✅ | SIGTERM/SIGINT graceful shutdown (`server.ts`) |
| Input validation (injection defense) | ✅ | Zod at every boundary (`middlewares/validateRequest.ts`, `validations/*`); parameterized queries via Prisma |
| Vendor/subprocessor risk | ⬜ org | Track in a vendor register |

---

## Availability
| Control | Status | Where / how |
|---|---|---|
| Liveness & readiness probes | ✅ | `/health`, `/ready` (probes DB + Redis) |
| Process management / auto-restart | ✅ | PM2 `ecosystem.config.js` (cluster, memory restart) |
| Containerized, reproducible deploys | ✅ | Self-contained per-server `Dockerfile`s + `docker-compose.yml` |
| Backups / DR | ⬜ org | Managed DB backups + tested restore |

## Processing Integrity
| Control | Status | Where / how |
|---|---|---|
| Schema-validated inputs & typed contracts | ✅ | Zod + inferred TS types; OpenAPI spec; strict `tsconfig` |
| Deterministic, tested business logic | ✅ | Layered services with unit + integration tests |
| Idempotent seeds/migrations | ✅ | Prisma migrations / idempotent seeds |

## Confidentiality
| Control | Status | Where / how |
|---|---|---|
| Secrets never in code/history | ✅ | `.env.example` only; gitleaks; env validation |
| Least-privilege data access | ✅ | There is no user directory and no cross-user read path in the API at all — `GET/PATCH/DELETE /auth/me` operate solely on the id embedded in the caller's own verified JWT (`routes/auth.routes.ts`). Passwords never serialized (`toPublic`/select). |
| Data classification | ⬜ org | Define per project |

## Privacy
| Control | Status | Where / how |
|---|---|---|
| Minimal PII collected | ✅ | User model stores email/name only |
| Right-to-erasure capability | 🟡 | User delete exists; add hard-delete/anonymization policy per project |
| Consent / privacy notice | ⬜ org | Product/legal responsibility |

---

## The audit flow (how to verify all of the above)

Run this end-to-end to produce evidence. Nothing here needs a paid tool.

```bash
# 1. Automated control checks (same as CI)
pnpm lint && pnpm type-check && pnpm test        # change management + integrity gates
pnpm --filter server test                    # 75% coverage gate (evidence: coverage/)
pnpm audit --audit-level high                    # CC3/CC7 vulnerability management

# 2. Secret hygiene (CC6)
git ls-files | grep -E '(^|/)\.env$' || echo "OK: no committed .env"
git log -p | grep -iE 'secret|api[_-]?key|password' | grep -vE 'example|change-me'  # expect empty

# 3. Access-control controls (CC6) — trace in code / tests
#    - Argon2:            server-*/src/utils/password.ts
#    - JWT rotation:      server-*/src/services/auth.service.ts (refreshAccessToken)
#    - Self-scoped auth:  server-*/src/middlewares/authMiddleware.ts (attaches req.user.userId;
#                          routes/auth.routes.ts — every /me handler reads only that id)
#    - Rate limiting:     server-*/src/middlewares/rateLimiter.ts

# 4. Audit trail (CC7) — exercise and observe
#    Start a server, hit /auth/login (good + bad), then /auth/me (PATCH + DELETE);
#    confirm audit lines: AUTH_LOGIN_SUCCESS / AUTH_LOGIN_FAILURE / USER_UPDATED / USER_DELETED with requestId.

# 5. Health & availability (Availability)
curl -s localhost:5012/health ; curl -s localhost:5012/ready

# 6. Static analysis + secret scan run in CI on every push:
#    .github/workflows/security.yml  →  pnpm audit · gitleaks · CodeQL
```

### Continuous evidence
- **Every PR:** `ci.yml` (build/test/lint gates) + `security.yml` (audit/gitleaks/CodeQL) must be green.
- **Weekly:** scheduled `security.yml` scan + Dependabot PRs.
- **Every commit:** commitlint + lint-staged (traceable, reviewable change history).

---

## Known gaps to close per project (P1/P2)

- **P1** Terminate TLS/HSTS at the edge and enable HSTS preload; document it.
- **P1** Ship logs to a central store (CloudWatch/Datadog/Loki) with retention ≥ 1 year for audit trails.
- **P2** Add a short threat model (STRIDE) and a data-classification table.
- **P2** Add right-to-erasure (hard delete/anonymization) and a retention policy.
- **P2** Add secret rotation runbook and a `SECURITY.md`-linked incident runbook.

See the **`soc2-readiness-audit`** section of the `takehome-assignment-audit` skill to score any repo against this matrix.
