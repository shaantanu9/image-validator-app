import type { AcceptedFormat } from '../utils/imageType';

/**
 * A rectangle in SOURCE pixel coordinates, in sharp's `extract` vocabulary
 * (`left`/`top`, not `x`/`y`) so it can be handed straight to sharp without a
 * lossy translation step.
 */
export interface FaceBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Every way an image can be rejected. This union IS the product spec — the six
 * required rules map onto it as:
 *
 *   1. too small (size or resolution) -> FILE_TOO_SMALL | RESOLUTION_TOO_SMALL
 *   2. not JPG/PNG/HEIC               -> UNSUPPORTED_FORMAT
 *   3. too similar to an existing one -> DUPLICATE
 *   4. blurry                         -> BLURRY
 *   5. detected face too small        -> FACE_TOO_SMALL
 *   6. multiple faces                 -> MULTIPLE_FACES
 *
 * The remainder are failure modes the six rules imply but do not name: an image
 * with NO face cannot satisfy rules 5/6, a corrupt file cannot be decoded, and a
 * decompression bomb must die before it is decoded at all.
 */
export type RejectionReason =
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_SMALL'
  | 'FILE_TOO_LARGE'
  | 'RESOLUTION_TOO_SMALL'
  | 'PIXEL_BUDGET_EXCEEDED'
  | 'IMAGE_UNREADABLE'
  | 'BLURRY'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'FACE_TOO_SMALL'
  | 'DUPLICATE';

export interface Rejection {
  ok: false;
  reason: RejectionReason;
  /** Human-facing specifics, e.g. "412x300 < 512x512". Never a stack trace. */
  detail?: string;
}

/** Everything measured about a file that PASSED every per-file gate. */
export interface ImageMetrics {
  format: AcceptedFormat;
  /** True when the original was HEIC and the stored bytes are a transcoded JPEG. */
  transcoded: boolean;
  bytes: number;
  width: number;
  height: number;
  /** Whole-frame Laplacian variance. A sanity floor, NOT the blur gate. */
  frameSharpness: number;
  /** Laplacian variance INSIDE the face box. This is the real blur gate. */
  faceSharpness: number;
  faceBox: FaceBox;
  pHash: string;
  pHashBands: string[];
  pHashAlgorithm: string;
}

export interface Accepted {
  ok: true;
  metrics: ImageMetrics;
  /** The bytes to persist — decodable (HEIC already transcoded). */
  buffer: Buffer;
}

export type FileVerdict = Accepted | Rejection;

/** A per-file verdict carrying the original filename, for the batch response. */
export interface NamedVerdict {
  originalName: string;
  verdict: FileVerdict;
}
