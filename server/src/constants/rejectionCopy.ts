import type { RejectionReason } from '../types/validation';

/**
 * Human-facing copy for every rejection.
 *
 * This lives in the BACKEND on purpose. The reason a photo was refused is a
 * property of the validation rule that fired, not of the screen rendering it — so
 * the rule and its explanation belong together. The client renders `label` under
 * the thumbnail and `message` in the hover tooltip; it never maps codes to strings
 * itself, which is how those two drift apart.
 *
 * `reason` stays the machine-readable code. Clients should branch on THAT, never on
 * the prose, so the copy can be reworded (or localised) without breaking anything.
 */
export interface RejectionCopy {
  /** Short label, shown under the thumbnail. */
  label: string;
  /** The explanation, shown on hover/expand. Tells the user what to DO. */
  message: string;
  /**
   * A UI affordance the client MAY offer to fix this specific problem.
   * `crop` means the photo is salvageable by re-framing; `replace` means it is not.
   */
  action: 'crop' | 'replace';
}

const REJECTION_COPY: Record<RejectionReason, RejectionCopy> = {
  BLURRY: {
    label: 'Blurry face detected',
    message:
      'This photo is not sharp enough around the face. Try a photo taken in better light, or one where you are holding still.',
    action: 'replace',
  },

  FACE_TOO_SMALL: {
    label: 'Face is too far away',
    message:
      'Your face takes up too little of this photo. Move closer to the camera, or crop the photo so your head and shoulders fill most of the frame.',
    action: 'crop',
  },

  MULTIPLE_FACES: {
    label: 'More than one face',
    message:
      'We found more than one person in this photo. Upload a photo of just you — or crop it so only your face is in frame.',
    action: 'crop',
  },

  NO_FACE: {
    label: 'No face detected',
    message:
      "We couldn't find a face in this photo. Make sure your face is visible, unobstructed, and facing the camera.",
    action: 'replace',
  },

  DUPLICATE: {
    label: 'Too similar to another upload',
    message:
      "You've already uploaded an image very similar to this one. Try uploading a variety of photos with different backgrounds, lighting, and clothing.",
    action: 'replace',
  },

  RESOLUTION_TOO_SMALL: {
    label: 'Photo is too low-resolution',
    message:
      'This image is too small to use. Upload the original photo rather than a screenshot, a thumbnail, or a version saved from a chat app.',
    action: 'replace',
  },

  FILE_TOO_SMALL: {
    label: 'File is too small',
    message:
      'This file is too small to be a real photo. Upload the original image rather than a compressed or downscaled copy.',
    action: 'replace',
  },

  FILE_TOO_LARGE: {
    label: 'File is too large',
    message: 'This file is bigger than we can accept. Upload a smaller version of the photo.',
    action: 'replace',
  },

  UNSUPPORTED_FORMAT: {
    label: 'Unsupported file type',
    message: 'We accept JPG, PNG and HEIC photos. Convert this file and try again.',
    action: 'replace',
  },

  PIXEL_BUDGET_EXCEEDED: {
    label: 'Photo is too large to process',
    message: 'This image has too many pixels for us to process. Upload a smaller version.',
    action: 'replace',
  },

  IMAGE_UNREADABLE: {
    label: "We couldn't open this photo",
    message:
      'This file appears to be corrupt or incomplete. Try exporting it again from your photo library.',
    action: 'replace',
  },
};

/** Never throw on an unknown code — an unexplained rejection is still a rejection. */
export const copyFor = (reason: string): RejectionCopy =>
  REJECTION_COPY[reason as RejectionReason] ?? {
    label: "This photo can't be used",
    message: 'This photo did not meet our guidelines. Try uploading a different one.',
    action: 'replace',
  };
