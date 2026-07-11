# Image Validator

Upload a batch of photos; each one is checked before it is stored. A photo is accepted only if it is
a readable image of a reasonable size, sharp enough, contains exactly one face large enough to work
with, and is not a near-duplicate of something you already uploaded. Rejected photos are kept too —
with the rule that rejected them and a human-readable reason, because "we threw it away" is not an
answer to "why was my photo refused?".

Validation runs **server-side on the real bytes**. The client's `Content-Type` and filename are never
trusted.

## Stack

- **Client** — Next.js 15 (App Router), Tailwind, Zustand
- **API** — Express + TypeScript, layered `routes → controllers → services → repositories`
- **Database** — PostgreSQL via Prisma; Redis for rate limiting and refresh tokens
- **Images** — sharp (decode, metrics), `heic-convert` (HEIC → JPEG), ImageKit (CDN storage)
- **Auth** — JWT access + rotating refresh tokens. **No roles**: every route acts only on the
  caller's own record, resolved from the verified token, never from a client-supplied id.

## Run it

```bash
pnpm install
pnpm db:up                                # Postgres + Redis (Docker)
cp server/.env.example server/.env        # add your IMAGEKIT_* keys here
cp client/.env.example client/.env.local
pnpm --filter server db:deploy            # apply Prisma migrations
pnpm --filter server db:seed              # demo@example.com / Demo@123456
pnpm dev
```

Client on **:3100**, API on **:5012**, Swagger at **/docs**.

> Editing `server/.env` requires a **restart** — the watcher reloads on source changes, not env
> changes. Missing `IMAGEKIT_*` keys are not fatal: uploads return `503` until they are set.

The background worker is a separate process; queued jobs sit unconsumed without it:

```bash
pnpm --filter server worker
```

## Validation rules

Applied in order; the first failure wins, and its reason is stored on the rejected row.

| Rule | Rejection | Default |
|---|---|---|
| Decodable JPEG / PNG / HEIC (sniffed from magic bytes) | `UNSUPPORTED_FORMAT`, `IMAGE_UNREADABLE` | — |
| File size within bounds | `FILE_TOO_SMALL`, `FILE_TOO_LARGE` | 1 KB – 10 MB |
| Resolution, and a pixel ceiling to stop decompression bombs | `RESOLUTION_TOO_SMALL`, `PIXEL_BUDGET_EXCEEDED` | ≥ 192 px; ≤ 24 MP |
| Sharpness — Laplacian variance, measured **inside the face box**, not the whole frame | `BLURRY` | frame ≥ 20, face ≥ 60 |
| Exactly one face, big enough to be usable | `NO_FACE`, `MULTIPLE_FACES`, `FACE_TOO_SMALL` | ≥ 90 px, ≥ 1% of frame |
| Not a near-duplicate of your own accepted photos (64-bit DCT pHash, Hamming distance) | `DUPLICATE` | distance ≤ 5 |

Every threshold is env-overridable (`FACE_SHARPNESS_MIN`, `DUPLICATE_MAX_DISTANCE`, …) — see
`server/src/config/validation.config.ts`.

Notes that matter:

- **Duplicate detection is owner-scoped** and compares against your *accepted* photos only. Two
  people may upload the same stock photo; you may not upload it twice.
- **A batch is decided under a per-owner lock**, so two identical photos in one request (or two
  concurrent requests) cannot both slip through the duplicate check.
- **HEIC is transcoded to JPEG** before storage — sharp's libvips cannot decode HEIC directly. The
  original format is recorded, so a stored JPEG is still known to have arrived as a HEIC.

## API

All routes are under `/api/v1` and require `Authorization: Bearer <accessToken>` unless noted.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/register`, `/auth/login` | public; returns access + refresh tokens |
| `POST` | `/auth/refresh-token`, `/auth/logout` | refresh rotates the token |
| `GET` `PATCH` `DELETE` | `/auth/me` | read / rename / delete **your own** account |
| `POST` | `/images` | **batch** multipart, field `images` — up to 20 files, 50 MB total |
| `GET` | `/images`, `/images/:id` | owner-scoped; `?status=ACCEPTED\|REJECTED` |
| `DELETE` | `/images/:id` | owner-scoped |
| `POST` | `/uploads/image` | single image straight to ImageKit, field `image` |

`POST /images` returns **200 with `{ accepted, rejected, meta }`** — a batch is not all-or-nothing, and
one bad photo never fails the others. Only a request with *no files at all* is a `400`.

```bash
curl -X POST http://localhost:5012/api/v1/images \
  -H "Authorization: Bearer $TOKEN" \
  -F images=@photo1.jpg -F images=@photo2.heic
```

Each rejected photo comes back with the machine-readable `reason`, the measurement that failed, and
copy the UI can show as-is:

```jsonc
{
  "originalName": "image.png",
  "status": "REJECTED",
  "reason": "FACE_TOO_SMALL",
  "detail": "47px < 90px",              // the actual measurement, not a stack trace
  "label": "Face is too far away",
  "message": "Your face takes up too little of this photo. Move closer to the camera, or crop …",
  "action": "crop"                      // what the user should do next
}
```

Rate limiting sits on the **write path only**, before any bytes are buffered. Putting it on the reads
too would 429 a client that merely polls its own upload status.

## Test it

```bash
pnpm lint && pnpm type-check && pnpm test && pnpm build   # the CI gate
pnpm test:api                                             # Bruno contract tests
pnpm test:e2e                                             # Puppeteer
```

Tests run against a real Postgres and Redis (`pnpm db:up` first) — no mocked database.

## Scope

**Built:** auth with rotating refresh tokens, the six-rule validation pipeline, owner-scoped image
CRUD, ImageKit storage, batch upload with partial success, Swagger, an audit trail, and the CI gate.

**Deliberately left out:** roles and any user directory (nothing needs them, and a directory is an
enumeration risk); async job-based validation (the batch is small enough to validate inline);
face *recognition* (identity) — this only detects that a face is present and usable.

See `CONTRIBUTING.md` for conventions and `docs/` for the compliance and route-protection notes.
