/**
 * Thresholds for the six validation rules.
 *
 * Every default here is derived from a measurement on a real 33-photo corpus, not
 * copied from a README. Where a number has no recorded calibration, that is said
 * out loud rather than dressed up.
 */

/**
 * `parseInt(env) || default` is a BUG: it silently turns `BLUR_THRESHOLD=0` into
 * the default, and 0 is a legal value for every threshold here (it disables the
 * gate). `??` is a DIFFERENT bug: `parseInt(undefined) ?? 500` is `NaN`, and the
 * env var being unset is the common case.
 *
 * The only correct form is an explicit finite check.
 */
const num = (v: string | undefined, fallback: number): number => {
  if (v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export interface ValidationConfig {
  // --- Rule 1: too small in size or resolution ---------------------------------
  /** Below this, nothing is a real photograph. */
  minBytes: number;
  maxBytes: number;
  /** Short side, in pixels. */
  minDimension: number;
  /** Decompression-bomb guard, enforced by ARITHMETIC before any decode. */
  maxPixels: number;

  // --- Rule 4: blurry -----------------------------------------------------------
  /**
   * Whole-frame Laplacian variance. A FLOOR, not the gate — it exists only so a
   * garbage image dies before we pay 60ms for the face model.
   */
  frameSharpnessMin: number;
  /**
   * Laplacian variance INSIDE the face box. THIS is the blur gate.
   *
   * Measured: a professional headshot with a deliberately soft background scores
   * face=623.9 / whole=203.9 — a whole-frame gate at 300 REJECTS it. A soft face
   * on a busy background scores face=106.7 / whole=242.3 — a whole-frame gate at
   * 200 ACCEPTS it, and for a photo product that is the worse error.
   */
  faceSharpnessMin: number;

  // --- Rules 5 & 6: face size and face count ------------------------------------
  /**
   * Recall floor handed to the detector. Deliberately LOWER than faceScoreMin so
   * that a weak/small face is still SEEN — and can be reported honestly as
   * FACE_TOO_SMALL rather than a lying NO_FACE.
   */
  faceDetectMin: number;
  /** Confidence at which a detection actually COUNTS as a face. */
  faceScoreMin: number;
  /** Short side of the face box, in source pixels. */
  faceMinPixels: number;
  /** Face box area as a fraction of the frame. Catches a person far away. */
  faceMinAreaRatio: number;

  // --- Rule 3: too similar to an existing one -----------------------------------
  /**
   * DCT pHash Hamming distance; <= this means duplicate.
   *
   * Measured over 465 pairs: the nearest UNRELATED pair sits at 18 bits for DCT
   * pHash (and at 11 for an average hash). A threshold of 5 leaves 13 bits of
   * headroom. The same aHash at its conventional 10 would leave one.
   */
  duplicateMaxDistance: number;
}

export const validationConfig: ValidationConfig = {
  minBytes: num(process.env['MIN_UPLOAD_BYTES'], 1_024),
  maxBytes: num(process.env['MAX_UPLOAD_BYTES'], 10 * 1024 * 1024),
  minDimension: num(process.env['MIN_IMAGE_DIMENSION'], 192),
  maxPixels: num(process.env['MAX_IMAGE_PIXELS'], 24_000_000),

  frameSharpnessMin: num(process.env['FRAME_SHARPNESS_MIN'], 20),
  faceSharpnessMin: num(process.env['FACE_SHARPNESS_MIN'], 60),

  faceDetectMin: num(process.env['FACE_DETECT_MIN'], 0.3),
  faceScoreMin: num(process.env['FACE_SCORE_MIN'], 0.5),
  faceMinPixels: num(process.env['FACE_MIN_PIXELS'], 90),
  faceMinAreaRatio: num(process.env['FACE_MIN_AREA_RATIO'], 0.01),

  duplicateMaxDistance: num(process.env['DUPLICATE_MAX_DISTANCE'], 5),
};
