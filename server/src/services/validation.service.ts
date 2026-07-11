import { validationConfig } from '../config/validation.config';
import { reconcileDuplicates } from '../domain/validation';
import { decisionLock } from '../lib/keyedMutex';
import { bandsOf } from '../lib/metrics';
import { detectFaces } from '../lib/faceDetector';
import { validateFile, type FaceDetector } from '../lib/validateFile';
import type { FileVerdict, NamedVerdict } from '../types/validation';
import type { ImageRepository } from '../database/repositories/image.repository';
import logger from '../utils/logger';

export interface IncomingFile {
  originalName: string;
  buffer: Buffer;
}

/**
 * PHASE 1 — concurrent, per-file properties ONLY.
 *
 * `Promise.allSettled`, never `Promise.all`. One corrupt file in a batch of ten
 * must not sink the other nine, and must not strand half the batch mid-state.
 */
export const measureFiles = async (
  files: readonly IncomingFile[],
  detect: FaceDetector = detectFaces,
): Promise<FileVerdict[]> => {
  const settled = await Promise.allSettled(
    files.map((f) => validateFile(f.buffer, detect, validationConfig)),
  );

  return settled.map((r, i): FileVerdict => {
    if (r.status === 'fulfilled') return r.value;
    // A throw here is OUR bug, not the user's — log it, but still answer the user
    // with a verdict rather than 500-ing their whole batch.
    logger.error('validateFile threw', {
      file: files[i]?.originalName,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    });
    return { ok: false, reason: 'IMAGE_UNREADABLE', detail: 'could not be processed' };
  });
};

export interface DecideResult {
  verdicts: NamedVerdict[];
}

/**
 * PHASE 2 — serial reconciliation, under a per-owner lock.
 *
 * Everything expensive (decode, face model, hashing) already happened in phase 1,
 * outside the lock. What runs INSIDE the lock is one indexed read, a synchronous
 * decision, and the inserts — milliseconds.
 *
 * The lock is what makes rule 3 correct across CONCURRENT REQUESTS. Without it,
 * two simultaneous uploads of the same photo each read the corpus before either
 * writes, so both see nothing and both are accepted. `await` is a yield point.
 *
 * `persist` runs inside the critical section on purpose: read-decide-INSERT must
 * be atomic. If the insert moved outside, the window would reopen.
 */
export const decideAndPersist = async (
  ownerId: string,
  files: readonly IncomingFile[],
  verdicts: readonly FileVerdict[],
  repo: ImageRepository,
  persist: (decided: NamedVerdict[]) => Promise<NamedVerdict[]>,
): Promise<DecideResult> =>
  decisionLock.runExclusive(ownerId, async () => {
    // Candidate prefilter: union of every accepted file's hash bands. One indexed
    // array-overlap query instead of loading the owner's entire corpus.
    const bands = [...new Set(verdicts.flatMap((v) => (v.ok ? bandsOf(v.metrics.pHash) : [])))];

    const priorHashes = bands.length > 0 ? await repo.findHashCandidates(ownerId, bands) : [];

    const decided = reconcileDuplicates(
      files.map((f) => f.originalName),
      verdicts,
      priorHashes,
      validationConfig.duplicateMaxDistance,
    );

    return { verdicts: await persist(decided) };
  });
