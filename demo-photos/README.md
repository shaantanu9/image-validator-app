# Demo photo set

13 fixtures for demoing the upload validator. **Every verdict below was produced by
running the file through the real `validateFile` pipeline with the real face
detector** — nothing here is assumed.

The faces are StyleGAN2-generated (thispersondoesnotexist.com). No real person is
depicted, so there is no likeness or licensing problem in showing these. Each
carries a small "StyleGAN2" watermark in the corner.

## What actually happens

Upload in filename order — `04` must follow `01` for the duplicate gate to fire.

| # | File | Verdict | Why |
|---|---|---|---|
| 01 | `01-accept-clean-a.jpg` | **ACCEPTED** | faceSharp 217, face 525×706 |
| 02 | `02-accept-clean-b.jpg` | **ACCEPTED** | faceSharp 73 |
| 03 | `03-accept-clean-c.jpg` | **ACCEPTED** | faceSharp 158 |
| 04 | `04-reject-duplicate-of-01.jpg` | `DUPLICATE` | **0 bits** from 01 (≤5) |
| 05 | `05-reject-group-shot.jpg` | `MULTIPLE_FACES` | 2 faces |
| 06 | `06-reject-blurry.jpg` | `BLURRY` | face sharpness 7.2 < 60 |
| 07 | `07-reject-face-too-small.jpg` | `FACE_TOO_SMALL` | 73px < 90px |
| 08 | `08-reject-no-face.jpg` | `NO_FACE` | — |
| 09 | `09-reject-too-small-resolution.jpg` | `RESOLUTION_TOO_SMALL` | 140×140, short side < 192 |
| 10 | `10-reject-format.gif` | `UNSUPPORTED_FORMAT` | gif |
| 11 | `11-NOT-ENFORCED-sunglasses.jpg` | **ACCEPTED** ⚠️ | no occlusion check exists |
| 12 | `12-dark-rejected-as-BLURRY.jpg` | `BLURRY` ⚠️ | rejected for the *wrong reason* |
| 13 | `13-NOT-ENFORCED-screenshot.jpg` | **ACCEPTED** ⚠️ | no screenshot check exists |

## Two things to know before you present

**04 is the strongest item in the set.** It is not a byte-copy of 01 — it was
re-encoded at a different JPEG quality (78 vs 92) and resized to 802×802. A
checksum would miss it completely. The perceptual hash puts it at **0 bits**.
That is the whole point of pHash, and it demos in one upload.

**Three of the stated rules are not implemented.** If the demo script claims them,
it will fail live:

- **Sunglasses / hats / covered face (11):** accepted, faceSharp 219. face-api
  detects a face fine behind sunglasses. There is no occlusion or accessory check.
- **Screenshots / photos of a screen (13):** accepted. There is no screenshot,
  moiré, or screen-capture detector.
- **Dark photos (12):** rejected — but as `BLURRY`, not as "too dark". There is no
  luminance gate. Darkening lowers contrast, which lowers Laplacian variance, which
  is what the blur gate measures. Two consequences: a dark-but-sharp photo is told
  *"your photo is too blurry"*, and whether it is caught at all depends on that
  face's baseline contrast (the same darkening was **accepted** on one source face
  and **rejected** on another). It is incidental, not a real gate.

## Regenerating

Fixtures are derived deterministically with `sharp` from freshly generated faces.
Blur is `blur(2)` — deliberately mild, so it clears the cheap whole-frame floor
(103 > 20) and dies at the real face-box gate (7.2 < 60). A heavier blur short-
circuits at the floor and never exercises the gate you actually care about.
