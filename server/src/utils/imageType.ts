// Sniff the REAL image type from the leading bytes. The client-supplied
// `Content-Type` header and `originalname` are not evidence — a `.png` can be a
// shell script — so we never trust them for a security decision.
//
// The product accepts exactly three formats: JPEG, PNG and HEIC. Everything else
// is still sniffed, so a rejection can NAME what it found ("WebP is not
// supported") rather than the useless "that file is not an image".
//
// Signatures:
//   PNG  → 89 50 4E 47 0D 0A 1A 0A
//   JPEG → FF D8 FF
//   WebP → "RIFF" …… "WEBP" at offset 8
//   GIF  → "GIF87a" / "GIF89a"
//   ISO-BMFF (HEIC/AVIF) → [4,8) === "ftyp", major brand at [8,12)
//
// HEIC and AVIF share the ISO-BMFF container, so the major BRAND — not the
// container — separates them. AVIF is HEIF-with-AV1 and sharp decodes it; HEIC is
// HEIF-with-HEVC and sharp CANNOT (see lib/heic.ts for the transcode).

export type AcceptedFormat = 'jpeg' | 'png' | 'heic';

// Formats we can identify but decline. Naming them makes the 415 honest.
export type DeclinedFormat = 'webp' | 'avif' | 'gif' | 'svg';

export type SniffedFormat = AcceptedFormat | DeclinedFormat;

export const ACCEPTED_FORMATS: readonly AcceptedFormat[] = ['jpeg', 'png', 'heic'] as const;

// HEIF major brands meaning HEVC-coded stills — what an iPhone produces.
// `mif1`/`msf1` are generic HEIF brands Apple also emits on some captures.
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

const startsWith = (buf: Buffer, bytes: readonly number[]): boolean =>
  buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

// SVG is an XSS payload wearing an image extension. Detect it over a BOUNDED
// prefix (never scan the whole body) so it can be declined explicitly.
const looksLikeSvg = (buf: Buffer): boolean => {
  // U+FEFF (the UTF-8 BOM) may precede the XML declaration. Written as an escape:
  // a literal BOM in source is invisible and trips no-irregular-whitespace.
  const head = buf
    .subarray(0, 1024)
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimStart();
  return /^<(\?xml|!--|!doctype\s+svg|svg[\s>])/i.test(head);
};

export const sniffImageFormat = (buf: Buffer): SniffedFormat | null => {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpeg';

  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  if (buf.length >= 6) {
    const g = buf.subarray(0, 6).toString('ascii');
    if (g === 'GIF87a' || g === 'GIF89a') return 'gif';
  }

  // ISO base media file format: bytes [4,8) are the literal "ftyp" box type.
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
    if (AVIF_BRANDS.has(brand)) return 'avif';
    if (HEIC_BRANDS.has(brand)) return 'heic';
    return null; // some other ftyp box (mp4/mov) — not a still image
  }

  if (looksLikeSvg(buf)) return 'svg';

  return null;
};

export const isAcceptedFormat = (f: SniffedFormat | null): f is AcceptedFormat =>
  f !== null && (ACCEPTED_FORMATS as readonly string[]).includes(f);

// The mime of the ORIGINAL upload. Note a HEIC is transcoded to JPEG before it is
// stored, so its stored mime differs from this one.
export const MIME_BY_FORMAT: Record<AcceptedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};
