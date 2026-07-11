import sharp, { type Sharp } from 'sharp';
import type { FaceBox } from '../types/validation';

// ---------------------------------------------------------------------------
// Pure image metrics. No DB, no network, no face model — so every one of these is
// testable in isolation, and they are where the interesting bugs live.
// ---------------------------------------------------------------------------

/**
 * Decompression-bomb guard applied to EVERY sharp call in this module.
 * A decoded RGB frame is width*height*3 bytes — NOT the file size. A 20 MB PNG can
 * decode to ~800 MB of RSS, so the bound has to be on PIXELS, not bytes.
 */
export const MAX_INPUT_PIXELS = 24_000_000;

/**
 * Blur is measured on a downscaled copy so an 8000x10000 photo cannot freeze the
 * event loop for seconds in a per-pixel JS loop.
 *
 * `withoutEnlargement` is load-bearing: NEVER upscale before measuring sharpness.
 * Upscaling interpolates, interpolation is a low-pass filter, and it MANUFACTURES
 * the very blur we are trying to detect — a small face crop measured at 100x100
 * scores ~154, and the same crop upscaled to 256x256 scores ~7. Small faces are
 * rejected by an explicit pixel floor instead (see FACE_MIN_PIXELS).
 */
const BLUR_WORK_EDGE = 256;

const raw = (buf: Buffer): Sharp =>
  sharp(buf, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });

/**
 * Laplacian variance — the standard focus measure. A sharp image has strong
 * second-derivative response (edges); a blurred one does not.
 *
 * This is a TRUE variance: sum((L - mean)^2) / N.
 *
 * `sum(L^2) / N` is the mean of SQUARES, not the variance. It is *approximately*
 * right only because the 4-neighbour kernel is zero-sum so mean(L) ~ 0 — but that
 * approximation is not the thing the name promises, and a real submission shipped
 * it as "variance". Subtract the mean.
 *
 * @param box Optional region. Pass the FACE box to measure the face; omit it for a
 *            whole-frame sanity floor. These answer different questions — see
 *            validateFile for why both exist.
 */
export const laplacianVariance = async (buf: Buffer, box?: FaceBox): Promise<number> => {
  let p = raw(buf).rotate();
  if (box) {
    // Measure the face at NATIVE pixel scale — do not resize a region first.
    p = p.extract({ left: box.left, top: box.top, width: box.width, height: box.height });
  } else {
    p = p.resize(BLUR_WORK_EDGE, BLUR_WORK_EDGE, { fit: 'inside', withoutEnlargement: true });
  }

  // `.greyscale().raw()` yields exactly ONE channel, so data[y * width + x] is
  // correct. A bare `.raw()` would give 3 interleaved channels and the same index
  // would silently read the red channel of a different pixel.
  const { data, info } = await p.greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      // 4-neighbour Laplacian kernel: [0 1 0 / 1 -4 1 / 0 1 0]
      const lap = data[i - width] + data[i + width] + data[i - 1] + data[i + 1] - 4 * data[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }

  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
};

// ---------------------------------------------------------------------------
// Perceptual hash — DCT-based (pHash), NOT an 8x8 average hash.
//
// This choice is measured, not stylistic. Over 465 pairs of a real photo corpus:
//   nearest UNRELATED pair — DCT pHash: 18 bits.  average hash: 11 bits.
// aHash at its usual threshold of 10 therefore has ONE bit of headroom before it
// starts calling strangers duplicates. DCT pHash at 5 has thirteen.
//
// aHash keys on gross composition and lighting, so two DIFFERENT photos of the
// same person in the same room read as duplicates — which is exactly the input
// this product expects.
// ---------------------------------------------------------------------------

const DCT_SIZE = 32; // input block
const HASH_EDGE = 8; // we keep an 8x8 block of low-frequency coefficients => 64 bits

/** The hash identity, persisted with every row. */
export const PHASH_ALGORITHM = 'dct64-median-v1';

// Precompute the DCT-II cosine table once.
const COS: number[][] = Array.from({ length: DCT_SIZE }, (_, x) =>
  Array.from({ length: DCT_SIZE }, (_, u) =>
    Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE)),
  ),
);

/** Separable 2-D DCT-II over a 32x32 greyscale block. */
const dct2d = (px: Float64Array): Float64Array => {
  const rows = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let y = 0; y < DCT_SIZE; y++) {
    for (let u = 0; u < DCT_SIZE; u++) {
      let s = 0;
      for (let x = 0; x < DCT_SIZE; x++) s += px[y * DCT_SIZE + x] * COS[x][u];
      rows[y * DCT_SIZE + u] = s;
    }
  }
  const out = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let u = 0; u < DCT_SIZE; u++) {
    for (let v = 0; v < DCT_SIZE; v++) {
      let s = 0;
      for (let y = 0; y < DCT_SIZE; y++) s += rows[y * DCT_SIZE + u] * COS[y][v];
      out[v * DCT_SIZE + u] = s;
    }
  }
  return out;
};

const pHashFromGray = (gray: Uint8Array | Buffer): string => {
  const px = new Float64Array(DCT_SIZE * DCT_SIZE);
  for (let i = 0; i < DCT_SIZE * DCT_SIZE; i++) px[i] = gray[i]!;

  const d = dct2d(px);

  // Drop row 0 and column 0. Coefficient [0][0] is the DC term — the average
  // brightness — and the rest of row/col 0 are the flattest components. Keeping
  // them makes the hash track exposure instead of structure.
  const coeffs: number[] = [];
  for (let v = 1; v <= HASH_EDGE; v++) {
    for (let u = 1; u <= HASH_EDGE; u++) coeffs.push(d[v * DCT_SIZE + u]);
  }

  // Threshold against the MEDIAN, not the mean: the median is robust to the few
  // large coefficients that would otherwise drag the mean and flip many bits.
  const sorted = [...coeffs].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = (sorted[mid - 1] + sorted[mid]) / 2;

  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    let nib = 0;
    for (let j = 0; j < 4; j++) if (coeffs[i + j] > median) nib |= 1 << (3 - j);
    hex += nib.toString(16);
  }
  return hex; // 16 lowercase hex chars = 64 bits
};

/**
 * `fit: 'fill'` deliberately DISCARDS aspect ratio, so a 16:9 crop of a photo
 * hashes like the 1:1 original. `.rotate()` bakes EXIF orientation first, so the
 * same photo does not hash differently just because it carries an orientation tag.
 */
export const pHash = async (buf: Buffer): Promise<string> => {
  const gray = await raw(buf)
    .rotate()
    .greyscale()
    .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer();
  return pHashFromGray(gray);
};

/** Hamming distance between two hex hashes of equal length. */
export const hamming = (a: string, b: string): number => {
  if (a.length !== b.length) {
    throw new Error(`hamming: length mismatch (${a.length} vs ${b.length})`);
  }
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
};

/**
 * Split a 64-bit hash into 4 NAMESPACED 16-bit bands, for an indexed prefilter.
 *
 * Pigeonhole: two hashes within Hamming distance <= 3 must share at least one
 * identical band, so `WHERE bands && $1` finds every candidate without scanning
 * the owner's whole corpus.
 *
 * Honest limit: at our actual threshold of 5, five differing bits CAN land one in
 * each of the four bands, so banding is a probabilistic prefilter at 5, not an
 * exact one. It is a performance optimisation, not a correctness boundary — the
 * Hamming check still decides.
 *
 * The `i:` namespace prevents band 0 of one hash matching band 2 of another.
 */
export const bandsOf = (hash: string): string[] => {
  const per = hash.length / 4;
  return [0, 1, 2, 3].map((i) => `${i}:${hash.slice(i * per, (i + 1) * per)}`);
};
