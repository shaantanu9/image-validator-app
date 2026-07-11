import {
  ACCEPTED_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_PHOTOS,
  ACCEPTED_LABEL,
} from '@/constants/upload';

export type RejectionReason = 'type' | 'size' | 'duplicate' | 'full';

export interface RejectedFile {
  file: File;
  reason: RejectionReason;
  /** Shown verbatim to the user. Says what happened and what to do about it. */
  message: string;
}

export interface ScreenResult {
  accepted: File[];
  rejected: RejectedFile[];
}

/**
 * Identity of a picked file, for de-duplication. The browser gives us no hash,
 * so name + size + mtime is the strongest signal available without reading the
 * bytes — enough to catch the common case of selecting the same photo twice.
 */
export const fileKey = (file: File): string => `${file.name}:${file.size}:${file.lastModified}`;

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Screen a freshly-picked batch against the upload contract before a single byte
 * leaves the browser. Runs in pick order and stops accepting once the set is
 * full, so the file that pushes past MAX_PHOTOS is the one that gets refused —
 * not an arbitrary one.
 *
 * @param files       what the user just picked or dropped
 * @param existingKeys keys of files already in the set (see `fileKey`)
 * @param remainingSlots how many more photos the set can still hold
 */
export const screenFiles = (
  files: File[],
  existingKeys: ReadonlySet<string>,
  remainingSlots: number,
): ScreenResult => {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  // Copy, so a duplicate *within* this same batch is caught too — not just one
  // that collides with a file already in the set.
  const seen = new Set(existingKeys);

  for (const file of files) {
    if (accepted.length >= remainingSlots) {
      rejected.push({
        file,
        reason: 'full',
        message: `You can upload ${MAX_PHOTOS} photos. Remove one to add this.`,
      });
      continue;
    }

    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
      rejected.push({
        file,
        reason: 'type',
        message: `That file isn’t a supported image. Use ${ACCEPTED_LABEL}.`,
      });
      continue;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      rejected.push({
        file,
        reason: 'size',
        message: `${formatBytes(file.size)} is over the 5MB limit. Try a smaller version.`,
      });
      continue;
    }

    const key = fileKey(file);
    if (seen.has(key)) {
      rejected.push({
        file,
        reason: 'duplicate',
        message: 'You’ve already added this photo.',
      });
      continue;
    }

    seen.add(key);
    accepted.push(file);
  }

  return { accepted, rejected };
};
