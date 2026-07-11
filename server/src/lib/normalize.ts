import sharp from 'sharp';
import { MAX_INPUT_PIXELS } from './metrics';

/**
 * Produce the bytes we actually STORE: orientation baked in, EXIF gone.
 *
 * ---------------------------------------------------------------------------
 * `sharp().withMetadata()` ENABLES metadata retention. sharp strips by DEFAULT.
 *
 * So the line that LOOKS like the privacy fix:
 *
 *     .rotate().withMetadata({ exif: {} })     // "strip EXIF for privacy"
 *
 * ...is the bug. Passing `{ exif: {} }` merges nothing and KEEPS the original
 * block — GPS coordinates included. Verified on sharp 0.34.5: a JPEG carrying
 * `Copyright: SECRET` still contains the literal string after that pipeline, and
 * the EXIF block survives at 216 bytes.
 *
 * The correct strip is `.rotate()` — which bakes orientation into the pixels and
 * drops the now-meaningless orientation tag — with `withMetadata()` OMITTED.
 *
 * For a portrait photo this is a user-location leak, so it is ASSERTED below
 * rather than commented. A comment cannot fail CI.
 * ---------------------------------------------------------------------------
 *
 * (The HEIC path arrives here already stripped: heic-convert emits via jpeg-js,
 * which writes no EXIF at all. This is belt and braces for that path, and the
 * actual fix for JPEG/PNG.)
 */
export const normalizeImage = async (buf: Buffer, quality = 92): Promise<Buffer> => {
  const out = await sharp(buf, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .jpeg({ quality })
    .toBuffer();

  const meta = await sharp(out).metadata();
  if (meta.exif !== undefined) {
    throw new Error('normalizeImage: EXIF survived the re-encode');
  }
  return out;
};
