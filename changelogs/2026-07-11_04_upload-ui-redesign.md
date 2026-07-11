# Photo-upload UI and full client restyle

**Date:** 2026-07-11
**Type:** Feature | UI Enhancement

## Summary

Rebuilt the Next.js client around a single job — uploading a photo set that will
actually pass validation — and gave it a visual identity to match. The upload flow
now **is** `/dashboard`: signing in drops you straight into it. Every existing page
(home, login, register, profile, 404, error, offline) was restyled onto the same
design tokens, so nothing looks like the old boilerplate.

The client now screens each file against the server's real contract **before** a
byte leaves the browser — format, size, duplicates, and the 10-photo cap — so a
user learns a photo is unusable immediately instead of after a round-trip and a
415/413.

## Design system

- **Coral → amber gradient** (`--brand-sweep`) is the app's single progress
  material. The top bar, the "N of 10" rule, and a photo's upload bar are all the
  same sweep, so a photo landing reads as one thing advancing rather than four
  unrelated widgets.
- **Warm neutrals** (`sand-*`) replace every cold grey, so nothing reads blue next
  to the coral. `primary-*` was repointed from stock blue to coral.
- **Poppins** (display) + **Inter** (body), exposed as CSS variables so
  `font-display` / `font-sans` are the only way to pick a face.
- Generous radii (`rounded-2xl`/`3xl`), warm-tinted shadows, `prefers-reduced-motion`
  respected, brand focus ring on `:focus-visible` only.

## Upload contract (mirrors the server)

- **JPEG, PNG, HEIC**, 5MB per file. WebP is now **rejected** client-side because
  `server/src/utils/imageType.ts` declines it.
- HEIC needed two special cases:
  - Chrome and Firefox report an **empty `file.type`** for `.heic`, so a MIME-only
    check would reject every photo straight off an iPhone. Screening falls back to
    the file extension.
  - No browser outside Safari can paint a HEIC in an `<img>`, so its local preview
    would be a broken image. Rows show a placeholder until the server returns the
    transcoded URL.
- 6-photo minimum, 10-photo maximum, 3 concurrent uploads (the server allows 30 per
  15 min, so a full batch is never near the limit).
- Duplicates are caught on `name:size:lastModified`, both against the existing set
  and **within the same batch**.

## Changes

- `/dashboard` is now the upload flow, with its own top bar (brand, progress,
  profile, sign out). The global navbar stands down on routes listed in
  `ROUTES_WITH_OWN_CHROME`.
- Two-column layout: dropzone + live file list on the left; counter, Photo
  requirements / Photo restrictions disclosures, and a grid of stored photos on the
  right.
- Per-photo states: queued → uploading (real progress) → done / error, with retry
  and remove. Removing a photo aborts its in-flight request and revokes its object
  URL.
- Home hero now swaps "Get started / Sign in" for a single "Upload photos" CTA when
  you are already signed in.
- 62 client tests pass, including 8 that drive the real page end-to-end (screening,
  upload, retry, removal, the 10-cap).

## Files Created

- `client/src/constants/upload.ts` — the upload contract, mirrored from the server
- `client/src/lib/uploadValidation.ts` — pre-flight screening (`screenFiles`)
- `client/src/hooks/useUploadQueue.ts` — the photo-set state machine
- `client/src/components/upload/` — `Dropzone`, `PhotoRow`, `UploadedPanel`,
  `Disclosure`, `ProgressSweep`, `UploadTopBar`
- `client/src/components/ui/BrandMark.tsx`
- `client/src/components/common/SiteHeader.tsx` — route-aware navbar
- `client/tests/lib/uploadValidation.test.ts`, `client/tests/components/Dropzone.test.tsx`,
  `client/tests/components/UploadFlow.test.tsx`

## Files Modified

- `client/tailwind.config.ts` — coral/ember/sand palette, display+body fonts, warm shadows
- `client/src/styles/globals.css` — `--brand-sweep`, base type, focus ring, reduced motion
- `client/src/app/layout.tsx` — Poppins + Inter, `SiteHeader`
- `client/src/app/(protected)/dashboard/page.tsx` — replaced with the upload flow
- `client/src/app/page.tsx` — new hero; signed-in users see "Upload photos"
- `client/src/app/(auth)/login|register/page.tsx`, `(protected)/profile/page.tsx`,
  `not-found.tsx`, `error.tsx`, `offline/page.tsx` — restyled
- `client/src/components/ui/Button|Card|Input|PasswordInput.tsx`,
  `components/common/Navbar.tsx|LoadingSpinner.tsx` — restyled
- `client/src/lib/imagekit.ts` — upload progress + abort signal
- `client/src/constants/routes.ts` — `ROUTES_WITH_OWN_CHROME`, `ownsChrome()`
- `client/tests/components/Input.test.tsx` — error assertion now checks `aria-invalid`
  plus the current class, instead of the removed `border-red-500`
