import { hamming } from '../lib/metrics';
import type { FileVerdict, NamedVerdict } from '../types/validation';

// ---------------------------------------------------------------------------
// Rule 3: "reject images too similar to an existing one".
//
// This is the rule that fails take-homes, because it is the only one that is a
// decision BETWEEN files rather than a property of one file. The moment two files
// can reject each other, `Promise.all` cannot help you.
//
// THE BUG (shipped by a real submission):
//
//   // "Phase 1: pre-save every sibling's pHash as PENDING so batch siblings
//   //  can find each other during the similarity check"
//   await Promise.all(files.map(f => Image.create({ ...f, pHash: hash(f) })))
//   await Promise.all(files.map(f => validate(f)))   // A sees B, B sees A
//
// Making siblings visible to each other is not a better query — it IS the bug.
// Visibility is SYMMETRIC: A sees B *and* B sees A, so both are rejected as
// duplicates and ZERO are accepted. Upload the same photo twice and you get
// nothing.
//
// THE FIX: validate concurrently (per-file properties only), then decide
// serially. A race is impossible in a synchronous loop.
//
// Two invariants this buys, both worth stating in the README:
//   1. EXACTLY ONE of N identical files is accepted. Never zero, never two.
//   2. The winner is deterministic — earliest in batch order — so it is testable.
// ---------------------------------------------------------------------------

/**
 * Decide duplicates across a batch, against the caller's existing corpus.
 *
 * PURE and SYNCHRONOUS: no sharp, no Prisma, no network. That is deliberate — it
 * makes the invariants above unit-testable without a database, and it means this
 * function cannot introduce an `await` yield point into the critical section.
 *
 * @param verdicts    per-file results from `validateFile`, in batch order
 * @param priorHashes pHashes already stored for THIS owner
 * @param maxDistance Hamming distance at or below which two hashes are "the same"
 */
export const reconcileDuplicates = (
  names: readonly string[],
  verdicts: readonly FileVerdict[],
  priorHashes: readonly string[],
  maxDistance: number,
): NamedVerdict[] => {
  // The corpus grows as we walk the batch, so an earlier sibling shadows a later
  // one — but never the reverse.
  const corpus: string[] = [...priorHashes];
  const out: NamedVerdict[] = [];

  for (let i = 0; i < verdicts.length; i++) {
    const verdict = verdicts[i];
    const originalName = names[i] ?? `file-${i}`;

    // A file rejected for ANY other reason never joins the corpus — otherwise a
    // blurry photo would shadow a later good one for no reason the user can see.
    if (!verdict.ok) {
      out.push({ originalName, verdict });
      continue;
    }

    const { pHash } = verdict.metrics;
    const clash = corpus.find((h) => h.length === pHash.length && hamming(h, pHash) <= maxDistance);

    if (clash !== undefined) {
      out.push({
        originalName,
        verdict: {
          ok: false,
          reason: 'DUPLICATE',
          detail: `matches an existing image (distance ${hamming(clash, pHash)} <= ${maxDistance})`,
        },
      });
      continue;
    }

    corpus.push(pHash);
    out.push({ originalName, verdict });
  }

  return out;
};
