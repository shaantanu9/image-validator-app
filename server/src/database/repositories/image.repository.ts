import type { ImageStatus } from '@prisma/client';
import type { FaceBox } from '../../types/validation';

export interface ImageRecord {
  id: string;
  ownerId: string;
  originalName: string;
  status: ImageStatus;
  rejectionReason: string | null;
  rejectionDetail: string | null;
  format: string | null;
  transcoded: boolean;
  bytes: number | null;
  width: number | null;
  height: number | null;
  frameSharpness: number | null;
  faceSharpness: number | null;
  faceBox: FaceBox | null;
  pHash: string | null;
  storageUrl: string | null;
  createdAt: Date;
}

/** An ACCEPTED row to insert. */
export interface AcceptedImageInput {
  ownerId: string;
  originalName: string;
  format: string;
  transcoded: boolean;
  bytes: number;
  width: number;
  height: number;
  frameSharpness: number;
  faceSharpness: number;
  faceBox: FaceBox;
  pHash: string;
  pHashBands: string[];
  pHashAlgorithm: string;
  storageKey: string | null;
  storageUrl: string | null;
}

/** A REJECTED row. Kept so the user can be told WHY, and so it shows in history. */
export interface RejectedImageInput {
  ownerId: string;
  originalName: string;
  reason: string;
  detail?: string | undefined;
}

export interface ImageRepository {
  /**
   * The corpus for rule 3. OWNER-SCOPED, and that is a product decision, not just
   * access control: a global corpus would tell user B that their photo duplicates
   * A STRANGER'S — with nothing on screen that could possibly explain why.
   *
   * Scoping also rescues the O(n) Hamming scan: n becomes one person's photo count.
   *
   * `bands` is the GIN-indexed prefilter — candidates only. The caller still does
   * the exact Hamming comparison, because banding is probabilistic at distance 5.
   */
  findHashCandidates(ownerId: string, bands: string[]): Promise<string[]>;

  createAccepted(input: AcceptedImageInput): Promise<ImageRecord>;
  createRejected(input: RejectedImageInput): Promise<ImageRecord>;

  listForOwner(ownerId: string, status?: ImageStatus): Promise<ImageRecord[]>;
  /** Returns null for a row belonging to someone else — the caller answers 404. */
  findForOwner(id: string, ownerId: string): Promise<ImageRecord | null>;
  deleteForOwner(id: string, ownerId: string): Promise<boolean>;
}
