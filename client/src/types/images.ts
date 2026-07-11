/**
 * The image API contract, mirrored from the server.
 *
 * Note what the server sends for a rejection: BOTH a machine code and human copy.
 *
 *   reason  — 'FACE_TOO_SMALL'. Stable. Branch on THIS.
 *   label   — 'Face is too far away'. Render under the thumbnail.
 *   message — the explanation, for the tooltip. Tells the user what to DO.
 *   action  — whether this photo is salvageable by re-framing ('crop') or not
 *             ('replace'), so we know whether to offer a Crop affordance.
 *
 * The prose lives on the server so the wording and the validation rule that
 * produced it stay in one place. A client-side code->string map is exactly how
 * those two drift apart.
 */

export type RejectionCode =
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

export interface FaceBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface AcceptedImage {
  id: string;
  originalName: string;
  status: 'ACCEPTED';
  url: string | null;
  format: string | null;
  /** True when the original was HEIC — the stored file is a transcoded JPEG. */
  transcoded: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  faceSharpness: number | null;
  faceBox: FaceBox | null;
  createdAt: string;
}

export interface RejectedImage {
  id: string;
  originalName: string;
  status: 'REJECTED';
  reason: RejectionCode;
  /** e.g. "face sharpness 21.0 < 60 (whole frame 868.6)" — auditable, not for the UI. */
  detail: string | null;
  label: string;
  message: string;
  action: 'crop' | 'replace';
  createdAt: string;
}

export type ImageRecord = AcceptedImage | RejectedImage;

export interface UploadResult {
  accepted: AcceptedImage[];
  rejected: RejectedImage[];
  meta: { total: number; accepted: number; rejected: number };
}
