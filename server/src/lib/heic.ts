import convert from 'heic-convert';
import sharp from 'sharp';
import type { AcceptedFormat } from '../utils/imageType';

// ---------------------------------------------------------------------------
// Why this module exists at all
//
// sharp CANNOT decode HEIC. Its prebuilt libvips is compiled without libheif's
// HEVC codec (HEVC is patent-encumbered; the encoder, x265, is GPL — both are
// incompatible with sharp's permissive prebuilt binary). AVIF works because it is
// HEIF-with-AV1, which is royalty-free and IS bundled.
//
// The failure mode is nasty, so it is worth stating precisely. Measured against a
// real Apple HEIC (sharp 0.35.3 / libvips 8.18.3):
//
//   sharp(heic).metadata()  -> SUCCEEDS. Reports `heif 474x843`.
//   sharp(heic).raw()       -> THROWS.   "heif: Support for this compression
//                                         format has not been built in"
//
// metadata() only parses the container header, so a naive implementation looks
// healthy in every smoke test and then dies on the first real iPhone photo.
// Never treat a successful metadata() as proof that a HEIC is decodable.
//
// `heic-convert` wraps libheif-js — an emscripten/WASM build of libheif that
// bundles its own HEVC decoder. It needs no system libraries, so it works on a
// clean CI runner and inside a slim Docker image. Cost: ~84 ms for a 41 KB HEIC.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Two behaviours of libheif that we RELY on, both verified rather than assumed:
//
// 1. ORIENTATION IS BAKED INTO THE PIXELS. libheif applies the container's
//    rotation when it decodes, so the RGBA it hands back is already upright.
//    This matters enormously: `heic-convert` emits its JPEG via jpeg-js, which
//    writes NO EXIF at all — so a downstream `sharp().rotate()` has no
//    orientation tag to act on and is a silent no-op. If libheif did NOT bake the
//    rotation in, every portrait iPhone photo would reach the face detector
//    sideways and simply fail to match. Verified: a 900x1200 source tagged
//    Orientation=6 comes back as 1200x900 — the correct display geometry.
//
// 2. EXIF IS DROPPED, which is a privacy WIN we take for free. GPS coordinates in
//    an iPhone photo never reach storage. (For the JPEG/PNG paths, EXIF still has
//    to be stripped explicitly — sharp strips by default, but ONLY if you do not
//    call `withMetadata()`. Calling `withMetadata({ exif: {} })` RETAINS it.)
//
// Caveat worth keeping honest: the fixtures above were produced by macOS `sips`.
// A device-captured HEIC may express rotation via the container's `irot` property
// rather than EXIF. Both are libheif's job and it handles both, but this should be
// confirmed once against a genuine iPhone capture before it is called closed.
// ---------------------------------------------------------------------------

/** JPEG quality for the HEIC transcode. High: this is the archival copy. */
const TRANSCODE_QUALITY = 0.92;

/**
 * Decompression-bomb guard. A HEIC decodes to width*height*4 bytes of RGBA in
 * WASM memory BEFORE we ever see it, so this cannot be enforced after the fact —
 * it is checked against the container header first.
 */
const MAX_HEIC_PIXELS = 50_000_000;

export class HeicDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeicDecodeError';
  }
}

/**
 * Transcode HEIC bytes to JPEG so that the rest of the pipeline — sharp, the
 * Laplacian, the pHash, the face detector — can decode them like any other photo.
 *
 * Returns a JPEG buffer with the rotation already applied and no EXIF.
 */
export const heicToJpeg = async (buf: Buffer): Promise<Buffer> => {
  // Bound the decode BEFORE handing the buffer to WASM. sharp can read the HEIF
  // container header even though it cannot decode the HEVC payload, which makes
  // it a usable (and cheap) size probe here.
  let meta;
  try {
    meta = await sharp(buf).metadata();
  } catch {
    throw new HeicDecodeError('Not a readable HEIC container.');
  }

  const { width, height } = meta;
  if (!width || !height) throw new HeicDecodeError('HEIC has no readable dimensions.');
  if (width * height > MAX_HEIC_PIXELS) {
    throw new HeicDecodeError(`HEIC exceeds the pixel budget (${width}x${height}).`);
  }

  try {
    const out = await convert({ buffer: buf as never, format: 'JPEG', quality: TRANSCODE_QUALITY });
    return Buffer.from(out);
  } catch (err) {
    // A truncated or HEVC-variant file libheif cannot handle. This is the
    // CLIENT's bad input, not a server fault — the caller maps it to a 4xx.
    throw new HeicDecodeError(err instanceof Error ? err.message : 'HEIC decode failed.');
  }
};

export interface DecodableImage {
  /** Bytes every downstream stage can decode. Identical to the input unless HEIC. */
  buffer: Buffer;
  /** The format actually sniffed from the ORIGINAL upload. */
  originalFormat: AcceptedFormat;
  /** True when the bytes were transcoded (i.e. the original was HEIC). */
  transcoded: boolean;
}

/**
 * The single ingest seam: hand it the sniffed format and the raw bytes, get back
 * bytes the rest of the pipeline can decode.
 *
 * Every stage downstream (dimension probe, decode, blur, pHash, face detection)
 * runs on `buffer` — so HEIC is transparent to all of them, and none of them need
 * to know it existed. Put this BEFORE the resolution gate: a HEIC's dimensions
 * cannot be trusted from the container alone.
 */
export const toDecodable = async (buf: Buffer, format: AcceptedFormat): Promise<DecodableImage> => {
  if (format !== 'heic') {
    return { buffer: buf, originalFormat: format, transcoded: false };
  }
  return { buffer: await heicToJpeg(buf), originalFormat: 'heic', transcoded: true };
};
