# HEIC ingest — sniff the ISO-BMFF brand, transcode HEVC to JPEG

**Date:** 2026-07-11
**Type:** Feature

## Summary

The assignment requires accepting HEIC uploads and converting them to PNG/JPEG. Nothing in the
codebase (or in either reference implementation available to us) could do this, because **sharp
cannot decode HEIC** — its prebuilt libvips omits libheif's HEVC codec (HEVC is patent-encumbered;
its encoder, x265, is GPL — both incompatible with sharp's permissive prebuilt binary). AVIF works
only because it is HEIF-with-AV1, which is royalty-free and *is* bundled.

The failure mode is deceptive and was verified against a genuine Apple HEIC on sharp 0.35.3 /
libvips 8.18.3:

```
sharp(heic).metadata()  -> SUCCEEDS. Reports `heif 474x843`.
sharp(heic).raw()       -> THROWS.   "heif: Support for this compression format
                                      has not been built in"
```

`metadata()` parses only the container header, so a naive implementation passes every smoke test
and then dies on the first real iPhone photo. This change adds a transcode at the ingest seam using
`heic-convert` (which wraps `libheif-js`, a WASM build of libheif carrying its own HEVC decoder — no
system libraries, so it works on a clean CI runner and in a slim Docker image). Measured cost:
~84 ms for a 41 KB HEIC.

Two libheif behaviours were **verified, not assumed**, because both are load-bearing:

1. **Orientation is baked into the pixels.** `heic-convert` emits its JPEG via `jpeg-js`, which
   writes no EXIF at all — so a downstream `sharp().rotate()` has no orientation tag to act on and
   is a silent no-op. If libheif did not apply the rotation itself, every portrait iPhone photo
   would reach face detection sideways and simply never match. Verified: a 900x1200 source tagged
   `Orientation=6` comes back as 1200x900 — the correct display geometry.
2. **EXIF is dropped**, which is a privacy win taken for free: GPS coordinates in an iPhone photo
   never reach storage.

Separately measured and worth recording: **pHash is unchanged across the transcode** (Hamming
distance 0 on three test photos, while an unrelated photo sits at 24). So the same picture uploaded
once as `.heic` and once as `.jpg` will still be caught by near-duplicate detection.

The accepted-format set was also narrowed from PNG/JPEG/**WebP** to **JPEG/PNG/HEIC**, matching the
spec. WebP, AVIF, GIF and SVG are still *identified* so a 415 can name the format it declined
instead of the useless "that file is not an image". SVG is detected over a bounded 1 KB prefix and
always rejected — it is an XSS payload wearing an image extension.

## Changes

- Added `heic-convert` + `sharp` (and `@types/heic-convert`) to the server.
- Rewrote the magic-byte sniffer to parse the ISO-BMFF `ftyp` box and its major brand, which is the
  only thing separating HEIC (HEVC) from AVIF (AV1) — they share a container.
- Guarded against a non-image `ftyp` box (an `.mp4`/`.mov` is ISO-BMFF too, and must not be treated
  as an image).
- Added a decompression-bomb guard (50 MP) enforced from the container header *before* the buffer is
  handed to WASM, since the RGBA decode happens outside our control.
- Typed `HeicDecodeError` so a truncated/unsupported HEIC becomes a 4xx (client's bad input) rather
  than a generic 500.
- Wired the transcode into `POST /uploads/image`; a HEIC is now stored as the JPEG we produce, not
  as the original undecodable bytes.

## Known gaps (deliberate, not oversights)

- The HEIC fixtures were produced by macOS `sips`. A device-captured HEIC may express rotation via
  the container's `irot` property rather than EXIF. libheif handles both, but this should be
  confirmed once against a genuine iPhone capture before it is called closed.
- **Browsers cannot preview HEIC.** Verified in Chrome: both `<img src=blob:...>` and
  `createImageBitmap()` fail (`InvalidStateError: The source image could not be decoded`). The
  frontend preview requirement therefore needs either a client-side WASM decode (`heic2any`) or a
  server-rendered thumbnail. Not addressed in this change.

## Files Created

- `server/src/lib/heic.ts` — `heicToJpeg()`, `toDecodable()`, `HeicDecodeError`
- `server/tests/unit/lib/heic.test.ts` — 12 tests
- `server/tests/fixtures/portrait.heic` — genuine Apple HEIC (HEVC Main Still Picture), 474x843
- `server/tests/fixtures/rotated.heic` — source tagged `Orientation=6`, to pin the orientation behaviour

## Files Modified

- `server/src/utils/imageType.ts` — replaced `sniffImageType` (returned a mime, allowed WebP) with
  `sniffImageFormat` + `isAcceptedFormat`; added ISO-BMFF brand parsing, GIF and SVG detection
- `server/src/controllers/upload.controller.ts` — sniff → accept-check → transcode → upload; the 415
  now names the declined format
- `server/src/constants/messages.ts` — `IMAGE_INVALID_TYPE` now reads "Only JPEG, PNG, and HEIC"
- `server/tests/integration/uploads.test.ts` — added an end-to-end case posting a real Apple HEIC and
  asserting the bytes that reach storage are a decodable 474x843 JPEG with no EXIF; added a case
  asserting the 415 names WebP
- `server/tests/unit/services/upload.service.test.ts` — updated to the new sniffer API; WebP is now
  identified-but-rejected
- `server/package.json` — new dependencies

## Verification

- `tsc --noEmit` — clean
- `eslint src tests` — clean
- Full server suite — **137/137 passing** (was 123; +12 HEIC unit, +2 upload integration)
