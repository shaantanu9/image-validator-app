import type { Image, ImageStatus, Prisma, PrismaClient } from '@prisma/client';

import type {
  AcceptedImageInput,
  ImageRecord,
  ImageRepository,
  RejectedImageInput,
} from './image.repository';
import type { FaceBox } from '../../types/validation';

const toRecord = (row: Image): ImageRecord => ({
  id: row.id,
  ownerId: row.ownerId,
  originalName: row.originalName,
  status: row.status,
  rejectionReason: row.rejectionReason,
  rejectionDetail: row.rejectionDetail,
  format: row.format,
  transcoded: row.transcoded,
  bytes: row.bytes,
  width: row.width,
  height: row.height,
  frameSharpness: row.frameSharpness,
  faceSharpness: row.faceSharpness,
  faceBox: (row.faceBox as FaceBox | null) ?? null,
  pHash: row.pHash,
  storageUrl: row.storageUrl,
  createdAt: row.createdAt,
});

export class PrismaImageRepository implements ImageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * The candidate lookup for rule 3.
   *
   * `phash_bands && $bands` is an ARRAY OVERLAP, served by the GIN index — so this
   * does not scan the owner's whole corpus. Only ACCEPTED rows are in the corpus:
   * a rejected photo must never shadow a later good one.
   *
   * NOTE: this is safe to keep ACCEPTED-only *because* the row is inserted
   * synchronously inside the same lock that reads it — there is no in-flight
   * window. The moment storage moves to a background queue, this query MUST also
   * admit PENDING/PROCESSING rows and a stale-row sweeper becomes mandatory,
   * otherwise two concurrent uploads of the same photo both see an empty corpus.
   */
  async findHashCandidates(ownerId: string, bands: string[]): Promise<string[]> {
    if (bands.length === 0) return [];

    const rows = await this.prisma.image.findMany({
      where: {
        ownerId,
        status: 'ACCEPTED',
        pHashBands: { hasSome: bands },
      },
      select: { pHash: true },
    });

    return rows.map((r) => r.pHash).filter((h): h is string => h !== null);
  }

  async createAccepted(input: AcceptedImageInput): Promise<ImageRecord> {
    const row = await this.prisma.image.create({
      data: {
        ownerId: input.ownerId,
        originalName: input.originalName,
        status: 'ACCEPTED',
        format: input.format,
        transcoded: input.transcoded,
        bytes: input.bytes,
        width: input.width,
        height: input.height,
        frameSharpness: input.frameSharpness,
        faceSharpness: input.faceSharpness,
        faceBox: input.faceBox as unknown as Prisma.InputJsonValue,
        pHash: input.pHash,
        pHashBands: input.pHashBands,
        pHashAlgorithm: input.pHashAlgorithm,
        storageKey: input.storageKey,
        storageUrl: input.storageUrl,
      },
    });
    return toRecord(row);
  }

  async createRejected(input: RejectedImageInput): Promise<ImageRecord> {
    const row = await this.prisma.image.create({
      data: {
        ownerId: input.ownerId,
        originalName: input.originalName,
        status: 'REJECTED',
        rejectionReason: input.reason,
        rejectionDetail: input.detail ?? null,
        pHashBands: [],
      },
    });
    return toRecord(row);
  }

  async listForOwner(ownerId: string, status?: ImageStatus): Promise<ImageRecord[]> {
    const rows = await this.prisma.image.findMany({
      where: { ownerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  /**
   * Scoped by ownerId in the WHERE clause, so another user's id simply returns
   * null and the caller answers 404 — NOT 403. A 403 would confirm the row exists.
   */
  async findForOwner(id: string, ownerId: string): Promise<ImageRecord | null> {
    const row = await this.prisma.image.findFirst({ where: { id, ownerId } });
    return row ? toRecord(row) : null;
  }

  async deleteForOwner(id: string, ownerId: string): Promise<boolean> {
    const { count } = await this.prisma.image.deleteMany({ where: { id, ownerId } });
    return count > 0;
  }
}
