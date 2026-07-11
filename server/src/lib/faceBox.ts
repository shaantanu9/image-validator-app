import type { FaceBox } from '../types/validation';

// ---------------------------------------------------------------------------
// `detection.box` is NOT a face box. Do not measure anything inside it.
//
// The SSD detector is trained to LOCALISE a face, not to BOUND it. Its box lands
// roughly brow-to-lip. Measured over a 32-photo corpus:
//
//   - it covers a MEAN 67% of the true face area (range 58%-75%)
//   - it clips above the brow by a mean 55px (max 112) and below the chin by a
//     mean 10px — on 32 of 32 photos, i.e. every single one
//   - sharpness measured inside it diverges from the true face box by a mean
//     -17.5%, range -62% to +27% — a SIGNED error wide enough to flip an
//     accept/reject verdict
//
// So the face box is derived from the 68 landmarks instead. The detector box is
// used only as a fallback when landmarks are unavailable.
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

// Landmark index ranges of the 68-point model.
const JAW: readonly [number, number] = [0, 17]; // the jaw outline; point 8 is the chin tip
const BROWS: readonly [number, number] = [17, 27]; // the TOPMOST landmarks — there are NO forehead points

/**
 * The 68-point model has no forehead landmarks at all — the brows are the top of
 * the world. So the forehead is extrapolated: the rule of thirds puts brow->chin
 * at about a third of face height, implying ~0.50 of that distance above the brow.
 * We use 0.55 to clear the hairline.
 */
const FOREHEAD_RATIO = 0.55;
const CHIN_PAD = 0.06;
const SIDE_PAD = 0.06;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Build the true face box from the 68 landmarks.
 *
 * Returns null on degenerate input, so the caller can fall back rather than
 * silently measure a zero-area region.
 */
export const faceBoxFromLandmarks = (
  pts: readonly Point[],
  imgW: number,
  imgH: number,
): FaceBox | null => {
  if (pts.length < 68) return null;

  const jaw = pts.slice(JAW[0], JAW[1]);
  const brows = pts.slice(BROWS[0], BROWS[1]);
  if (jaw.length === 0 || brows.length === 0) return null;

  // The chin is the LOWEST point of the whole jaw outline, not landmark 8. With
  // head roll, the true lowest jaw point is not the chin tip — taking the max over
  // the set is roll-safe; hardcoding index 8 is not.
  const chinY = Math.max(...jaw.map((p) => p.y));
  const browY = Math.min(...brows.map((p) => p.y));

  const browToChin = chinY - browY;
  if (browToChin <= 0) return null;

  const topY = browY - FOREHEAD_RATIO * browToChin;
  const botY = chinY + CHIN_PAD * browToChin;

  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const padX = SIDE_PAD * (maxX - minX);

  const left = clamp(Math.round(minX - padX), 0, imgW);
  const top = clamp(Math.round(topY), 0, imgH);
  const right = clamp(Math.round(maxX + padX), 0, imgW);
  const bottom = clamp(Math.round(botY), 0, imgH);

  const width = right - left;
  const height = bottom - top;
  if (width < 1 || height < 1) return null;

  return { left, top, width, height };
};

/**
 * Fallback when landmarks are missing: grow the detector box to approximate the
 * real extent. Mostly upward, because that is where the clipping is worst.
 */
export const growDetectorBox = (
  box: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number,
): FaceBox => {
  const left = clamp(Math.round(box.x - 0.05 * box.width), 0, imgW);
  const top = clamp(Math.round(box.y - 0.3 * box.height), 0, imgH);
  const right = clamp(Math.round(box.x + 1.05 * box.width), 0, imgW);
  const bottom = clamp(Math.round(box.y + 1.15 * box.height), 0, imgH);
  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
};

/**
 * Keep a box strictly inside the image. sharp's `extract` throws if the region
 * runs even one pixel over the edge, and a face at the frame border is common.
 */
export const clampBox = (box: FaceBox, imgW: number, imgH: number): FaceBox => {
  const left = clamp(box.left, 0, Math.max(0, imgW - 1));
  const top = clamp(box.top, 0, Math.max(0, imgH - 1));
  return {
    left,
    top,
    width: Math.max(1, Math.min(box.width, imgW - left)),
    height: Math.max(1, Math.min(box.height, imgH - top)),
  };
};

/** Short side of a box, in source pixels. The honest measure of "how big is this face". */
export const shortSideOf = (box: FaceBox): number => Math.min(box.width, box.height);

/** Box area as a fraction of the frame. Catches "a person far away in a wide shot". */
export const areaRatioOf = (box: FaceBox, imgW: number, imgH: number): number =>
  (box.width * box.height) / (imgW * imgH);
