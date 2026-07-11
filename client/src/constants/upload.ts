// The upload contract, mirrored from the server so the UI can reject a file
// before it costs a round-trip. These numbers MUST track the backend:
//   - MAX_IMAGE_BYTES      → server/src/middlewares/uploadImage.ts
//   - ACCEPTED_MIME_TYPES  → server/src/utils/imageType.ts (magic-byte sniff)
// The client check is a courtesy, not a security boundary — the server still
// sniffs the real bytes and is the only thing that can be trusted.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, per file

export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// What the file picker offers. `image/jpeg` alone misses .jpg on some platforms,
// so the extensions are listed too.
export const FILE_INPUT_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

/** Below this, the set is not usable — the primary action stays disabled. */
export const MIN_PHOTOS = 6;

/** The set is full at this point; the dropzone stops accepting. */
export const MAX_PHOTOS = 10;

/**
 * How many uploads run at once. The server allows 30 uploads per 15 minutes per
 * user, so a full 10-photo batch is never near the limit — 3 just keeps the
 * progress list legible instead of ten spinners racing.
 */
export const UPLOAD_CONCURRENCY = 3;

export const ACCEPTED_LABEL = 'PNG, JPG, WEBP up to 5MB';

export const PHOTO_REQUIREMENTS = [
  'A clear, well-lit shot of one person — you.',
  'A mix of close-ups, selfies and mid-range shots.',
  'Recent photos that look like you do today.',
  'Variety in background, outfit and expression.',
  'PNG, JPG or WEBP, under 5MB each.',
] as const;

export const PHOTO_RESTRICTIONS = [
  'No group shots — we can’t tell which face is yours.',
  'No sunglasses, hats or anything covering your face.',
  'No blurry, dark or heavily filtered photos.',
  'No screenshots or photos of a screen.',
  'No duplicates — each photo has to be a different moment.',
] as const;
