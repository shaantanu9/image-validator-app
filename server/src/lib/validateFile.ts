import sharp from 'sharp';

import { validationConfig, type ValidationConfig } from '../config/validation.config';
import { isAcceptedFormat, sniffImageFormat } from '../utils/imageType';
import { HeicDecodeError, toDecodable } from './heic';
import {
  areaRatioOf,
  clampBox,
  faceBoxFromLandmarks,
  growDetectorBox,
  shortSideOf,
  type Point,
} from './faceBox';
import { bandsOf, laplacianVariance, MAX_INPUT_PIXELS, pHash, PHASH_ALGORITHM } from './metrics';
import { normalizeImage } from './normalize';
import type { FaceBox, FileVerdict } from '../types/validation';

// ---------------------------------------------------------------------------
// The detector is INJECTED, not imported.
//
// That single decision is why every reject reason below can be tested against a
// fake in milliseconds, with no tfjs, no 5.4 MB of weights, and no 60ms of
// inference per case. The real adapter (lib/faceDetector.ts) is one import away
// and is exercised separately by the integration suite.
// ---------------------------------------------------------------------------
export interface DetectedFace {
  /** The DETECTOR's box — brow-to-lip. Never measure inside it; see faceBox.ts. */
  box: { x: number; y: number; width: number; height: number };
  score: number;
  /** The 68 landmarks, from which the TRUE face box is derived. */
  landmarks?: readonly Point[];
}

export type FaceDetector = (buf: Buffer) => Promise<DetectedFace[]>;

/**
 * Validate ONE file against the per-file rules.
 *
 * Rule 3 (duplicate) is deliberately NOT decided here. A duplicate verdict is a
 * decision BETWEEN files, and this function is designed to run under
 * `Promise.allSettled` across a whole batch — so any cross-file decision made in
 * here would race. Duplicates are reconciled serially: see domain/validation.ts.
 *
 * ORDER IS CHEAPEST-FIRST, and the ordering is worth 3 orders of magnitude.
 * Measured on this machine, per 1 MP image:
 *
 *   byte length + magic bytes + dimension probe  ->   0.042 ms   (combined)
 *   decode to pixels                             ->   6.5  ms
 *   FACE DETECTION                               ->  60.1  ms    <- 68% of total
 *
 * Face detection costs 1422x every pre-decode gate put together. Any ordering that
 * runs it before a free check is wrong by three orders of magnitude.
 *
 * The one deliberate exception is blur: it must be measured INSIDE the face box,
 * which requires detection first. So blur is split — a cheap whole-frame floor runs
 * early (to kill garbage before we pay for the model), and the real face-box gate
 * runs after detection.
 */
export const validateFile = async (
  input: Buffer,
  detect: FaceDetector,
  cfg: ValidationConfig = validationConfig,
): Promise<FileVerdict> => {
  // --- Gate 1: byte length. Free. --------------------------------------------
  if (input.length < cfg.minBytes) {
    return { ok: false, reason: 'FILE_TOO_SMALL', detail: `${input.length}B < ${cfg.minBytes}B` };
  }
  if (input.length > cfg.maxBytes) {
    return { ok: false, reason: 'FILE_TOO_LARGE', detail: `${input.length}B > ${cfg.maxBytes}B` };
  }

  // --- Gate 2: format, from MAGIC BYTES. Never `file.mimetype` — that is
  //     client-supplied, and a `.png` can be a shell script. -------------------
  const format = sniffImageFormat(input);
  if (!isAcceptedFormat(format)) {
    return { ok: false, reason: 'UNSUPPORTED_FORMAT', detail: format ?? 'unknown' };
  }

  // --- HEIC transcode. sharp cannot decode HEVC, so this normalises the bytes
  //     once, here, and every stage below is format-blind. ----------------------
  let buf: Buffer;
  let transcoded: boolean;
  try {
    const decodable = await toDecodable(input, format);
    buf = decodable.buffer;
    transcoded = decodable.transcoded;
  } catch (err) {
    if (err instanceof HeicDecodeError) {
      return { ok: false, reason: 'IMAGE_UNREADABLE', detail: err.message };
    }
    throw err;
  }

  // --- Gate 3: dimensions, from the HEADER. No decode yet. --------------------
  let width: number;
  let height: number;
  try {
    const meta = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, reason: 'IMAGE_UNREADABLE', detail: 'no dimensions' };
    }
    // EXIF orientation 5-8 means the image DISPLAYS rotated 90 degrees, so the
    // stored width/height are swapped relative to what the user (and the face
    // detector, which sees post-rotate pixels) will actually see.
    const swapped = (meta.orientation ?? 1) >= 5;
    width = swapped ? meta.height : meta.width;
    height = swapped ? meta.width : meta.height;
  } catch {
    return { ok: false, reason: 'IMAGE_UNREADABLE', detail: 'could not read header' };
  }

  // --- Gate 4: pixel budget. Pure ARITHMETIC — this is the bomb guard, and it
  //     has to happen BEFORE a decode, because the decode is the attack. --------
  if (width * height > cfg.maxPixels) {
    return {
      ok: false,
      reason: 'PIXEL_BUDGET_EXCEEDED',
      detail: `${width}x${height} exceeds ${cfg.maxPixels}px`,
    };
  }

  // --- Rule 1: resolution ------------------------------------------------------
  if (Math.min(width, height) < cfg.minDimension) {
    return {
      ok: false,
      reason: 'RESOLUTION_TOO_SMALL',
      detail: `${width}x${height}, short side < ${cfg.minDimension}px`,
    };
  }

  // --- Rule 4a: whole-frame sharpness FLOOR (not the gate) ---------------------
  // Cheap, and it exists purely to avoid paying 60ms of face model on a blank or
  // corrupt frame. The REAL blur decision happens inside the face box, below.
  let frameSharpness: number;
  try {
    frameSharpness = await laplacianVariance(buf);
  } catch {
    return { ok: false, reason: 'IMAGE_UNREADABLE', detail: 'decode failed' };
  }
  if (frameSharpness < cfg.frameSharpnessMin) {
    return {
      ok: false,
      reason: 'BLURRY',
      detail: `frame sharpness ${frameSharpness.toFixed(1)} < ${cfg.frameSharpnessMin}`,
    };
  }

  // --- Rules 5 & 6: the expensive stage. Everything above exists to make sure
  //     we never reach it on a photo that could have died for free. -------------
  const detections = await detect(buf);

  // The TRUE face box comes from the 68 landmarks. `detection.box` is brow-to-lip
  // and covers only ~67% of the face — it is a fallback, never the measurement.
  const trueBox = (f: DetectedFace): FaceBox =>
    clampBox(
      (f.landmarks && faceBoxFromLandmarks(f.landmarks, width, height)) ??
        growDetectorBox(f.box, width, height),
      width,
      height,
    );

  const confident = detections.filter((f) => f.score >= cfg.faceScoreMin);

  if (confident.length === 0) {
    // Be honest about WHY. If something face-shaped WAS seen but was below the
    // confidence bar, and it is tiny, the truthful reason is FACE_TOO_SMALL — not
    // a NO_FACE that the code cannot actually support.
    const seen = detections.map(trueBox).map(shortSideOf);
    const largest = seen.length > 0 ? Math.max(...seen) : 0;
    if (largest > 0 && largest < cfg.faceMinPixels) {
      return { ok: false, reason: 'FACE_TOO_SMALL', detail: `${Math.round(largest)}px` };
    }
    return { ok: false, reason: 'NO_FACE' };
  }

  // Rule 5, part 1 — a PIXEL floor on the face's short side.
  //
  // Kept separate from the area ratio on purpose: a small crop scores HIGH on
  // Laplacian variance when measured at native resolution, so without an explicit
  // pixel floor "small" gets laundered as "sharp".
  const usable = confident.filter((f) => shortSideOf(trueBox(f)) >= cfg.faceMinPixels);
  if (usable.length === 0) {
    const largest = Math.max(...confident.map((f) => shortSideOf(trueBox(f))));
    return {
      ok: false,
      reason: 'FACE_TOO_SMALL',
      detail: `${Math.round(largest)}px < ${cfg.faceMinPixels}px`,
    };
  }

  // Rule 6 — multiple faces.
  //
  // Filter by confidence AND size FIRST, then count. Order matters: a 37px face on
  // a poster in the background must not reject an otherwise perfect selfie.
  if (usable.length > 1) {
    return { ok: false, reason: 'MULTIPLE_FACES', detail: `${usable.length} faces` };
  }

  const face = usable[0];
  const box = trueBox(face);

  // Rule 5, part 2 — the face must occupy a real share of the frame.
  const areaRatio = areaRatioOf(box, width, height);
  if (areaRatio < cfg.faceMinAreaRatio) {
    return {
      ok: false,
      reason: 'FACE_TOO_SMALL',
      detail: `${(areaRatio * 100).toFixed(1)}% of frame`,
    };
  }

  // --- Rule 4b: THE blur gate — inside the face box, at native pixel scale. ----
  const faceSharpness = await laplacianVariance(buf, box);
  if (faceSharpness < cfg.faceSharpnessMin) {
    return {
      ok: false,
      reason: 'BLURRY',
      detail: `face sharpness ${faceSharpness.toFixed(1)} < ${cfg.faceSharpnessMin} (whole frame ${frameSharpness.toFixed(1)})`,
    };
  }

  // --- Happy path only: hash it. Rule 3 is decided later, serially. ------------
  const hash = await pHash(buf);

  // The bytes we will STORE: orientation baked in, EXIF (and its GPS) gone.
  // Only accepted files pay for this re-encode.
  //
  // The hash is computed on the PRE-normalised buffer, which is safe: pHash applies
  // `.rotate()` internally and is invariant to re-encoding (measured — a JPEG q40
  // round-trip moves the hash by 0 bits). Doing it this way means a rejected file
  // never pays for a re-encode nobody will use.
  const stored = await normalizeImage(buf);

  return {
    ok: true,
    buffer: stored,
    metrics: {
      format,
      transcoded,
      bytes: stored.length,
      width,
      height,
      frameSharpness,
      faceSharpness,
      faceBox: box,
      pHash: hash,
      pHashBands: bandsOf(hash),
      pHashAlgorithm: PHASH_ALGORITHM,
    },
  };
};
