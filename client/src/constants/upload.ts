// The upload contract, mirrored from the server so the UI can reject a file
// before it costs a round-trip. These MUST track the backend:
//   - MAX_IMAGE_BYTES → server/src/middlewares/uploadImage.ts
//   - the accepted set → server/src/utils/imageType.ts (ACCEPTED_FORMATS)
// The client check is a courtesy, not a security boundary — the server sniffs the
// real bytes and is the only thing that can be trusted.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, per file

// The server accepts exactly these three and DECLINES WebP/AVIF/GIF/SVG.
// `image/heif` is included because some browsers label a HEIC that way.
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const;

/**
 * Extension fallback. Chrome and Firefox report an EMPTY `file.type` for a `.heic`
 * — the OS has no MIME registered for it off Apple platforms — so a MIME-only
 * check would reject every photo straight off an iPhone. The extension is the
 * only signal we have in that case; the server still sniffs the bytes.
 */
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif'] as const;

// What the file picker offers.
export const FILE_INPUT_ACCEPT =
  '.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif';

/**
 * Browsers cannot decode HEIC in an <img>, so a local preview of one renders as a
 * broken image. We show a placeholder until the server hands back the transcoded
 * URL. (Safari can decode it, but it is not worth branching on.)
 */
export const LOCALLY_RENDERABLE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

/** Below this, the set is not usable. */
export const MIN_PHOTOS = 6;

/** The set is full at this point; the dropzone stops accepting. */
export const MAX_PHOTOS = 10;

/**
 * Uploads run ONE AT A TIME, and that is a correctness decision, not a throttle.
 *
 * Duplicate detection is a decision BETWEEN photos. The server guarantees that
 * exactly one of N identical photos is accepted — but WHICH one depends on the
 * order the requests arrive in. Fire three at once and they race: a user who picks
 * `photo.jpg` and a downscaled `photo-small.jpg` can watch the ORIGINAL get
 * rejected as a duplicate of the copy. (Observed exactly that at concurrency 3.)
 *
 * Sequential upload makes the winner the one the user picked FIRST, deterministically
 * — which is both the documented behaviour and the only one that isn't baffling.
 *
 * The cost is real but small: validation is ~300ms/photo, so a full 10-photo set
 * takes ~3s instead of ~1.5s.
 */
export const UPLOAD_CONCURRENCY = 1;

export const ACCEPTED_LABEL = 'PNG, JPG, HEIC up to 5MB';

export const PHOTO_REQUIREMENTS = [
  'A clear, well-lit shot of one person — you.',
  'A mix of close-ups, selfies and mid-range shots.',
  'Recent photos that look like you do today.',
  'Variety in background, outfit and expression.',
  'PNG, JPG or HEIC, under 5MB each.',
] as const;

export const PHOTO_RESTRICTIONS = [
  'No group shots — we can’t tell which face is yours.',
  'No sunglasses, hats or anything covering your face.',
  'No blurry, dark or heavily filtered photos.',
  'No screenshots or photos of a screen.',
  'No duplicates — each photo has to be a different moment.',
] as const;
