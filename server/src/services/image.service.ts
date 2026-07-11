import type { ImageStatus } from '@prisma/client';

import { imageRepository } from '../database/repositories';
import type { ImageRecord, ImageRepository } from '../database/repositories/image.repository';
import { decideAndPersist, measureFiles, type IncomingFile } from './validation.service';
import { isImageKitConfigured, uploadToImageKit } from './upload.service';
import type { NamedVerdict } from '../types/validation';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

export interface UploadOutcome {
  accepted: ImageRecord[];
  rejected: ImageRecord[];
}

const extFor = (format: string, transcoded: boolean): string =>
  transcoded || format === 'jpeg' ? 'jpg' : 'png';

/**
 * The upload pipeline for a batch of 1..N files.
 *
 *   phase 1 — validate every file CONCURRENTLY (per-file rules 1,2,4,5,6)
 *   phase 2 — decide duplicates SERIALLY under a per-owner lock (rule 3), and
 *             persist, in the same critical section
 *
 * A rejected photo is not a failed request: the caller gets 200 with a verdict per
 * file, split into accepted / rejected. Only a request with NO files at all is 400.
 */
export const uploadImages = async (
  ownerId: string,
  files: readonly IncomingFile[],
  repo: ImageRepository = imageRepository,
): Promise<UploadOutcome> => {
  if (files.length === 0) throw ApiError.badRequest('No files were uploaded.');

  const verdicts = await measureFiles(files);

  const accepted: ImageRecord[] = [];
  const rejected: ImageRecord[] = [];

  await decideAndPersist(ownerId, files, verdicts, repo, async (decided: NamedVerdict[]) => {
    for (const { originalName, verdict } of decided) {
      if (!verdict.ok) {
        // Rejected rows are PERSISTED, not discarded. The user asked why their
        // photo was refused; "we threw it away" is not an answer, and the history
        // view needs them.
        rejected.push(
          await repo.createRejected({
            ownerId,
            originalName,
            reason: verdict.reason,
            detail: verdict.detail,
          }),
        );
        continue;
      }

      const { metrics, buffer } = verdict;

      // Storage is best-effort and must NOT invalidate a valid verdict. If the CDN
      // is down the image is still accepted and its metrics recorded; the row simply
      // carries no URL yet. (Moving this to a background queue is the next step —
      // and it will require the corpus query to admit in-flight rows plus a sweeper.)
      let storageKey: string | null = null;
      let storageUrl: string | null = null;

      if (isImageKitConfigured()) {
        try {
          const name = `${ownerId}-${Date.now()}-${metrics.pHash}.${extFor(metrics.format, metrics.transcoded)}`;
          const result = await uploadToImageKit(buffer, name);
          storageKey = result.fileId;
          storageUrl = result.url;
        } catch (err) {
          logger.error('ImageKit upload failed; image accepted without a URL', {
            ownerId,
            originalName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      accepted.push(
        await repo.createAccepted({
          ownerId,
          originalName,
          format: metrics.format,
          transcoded: metrics.transcoded,
          bytes: metrics.bytes,
          width: metrics.width,
          height: metrics.height,
          frameSharpness: metrics.frameSharpness,
          faceSharpness: metrics.faceSharpness,
          faceBox: metrics.faceBox,
          pHash: metrics.pHash,
          pHashBands: metrics.pHashBands,
          pHashAlgorithm: metrics.pHashAlgorithm,
          storageKey,
          storageUrl,
        }),
      );
    }
    return decided;
  });

  return { accepted, rejected };
};

export const listImages = (ownerId: string, status?: ImageStatus): Promise<ImageRecord[]> =>
  imageRepository.listForOwner(ownerId, status);

/**
 * A row belonging to someone else is a 404, NOT a 403 — a 403 would confirm the
 * row exists. A malformed uuid is also a 404, not a 500.
 */
export const getImage = async (id: string, ownerId: string): Promise<ImageRecord> => {
  const row = await imageRepository.findForOwner(id, ownerId).catch(() => null);
  if (!row) throw ApiError.notFound('Image not found.');
  return row;
};

export const deleteImage = async (id: string, ownerId: string): Promise<void> => {
  const ok = await imageRepository.deleteForOwner(id, ownerId).catch(() => false);
  if (!ok) throw ApiError.notFound('Image not found.');
};
