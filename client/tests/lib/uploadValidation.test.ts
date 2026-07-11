import { describe, it, expect } from 'vitest';
import { fileKey, formatBytes, screenFiles } from '@/lib/uploadValidation';
import { MAX_IMAGE_BYTES } from '@/constants/upload';

// jsdom's File doesn't let you set an arbitrary size, so build one whose bytes
// really are the length we want to test against.
const makeFile = (name: string, type: string, size = 1024, lastModified = 1): File =>
  new File([new Uint8Array(size)], name, { type, lastModified });

const NO_KEYS = new Set<string>();

describe('screenFiles', () => {
  it('accepts a supported image that is under the size limit', () => {
    const file = makeFile('selfie.jpg', 'image/jpeg');
    const { accepted, rejected } = screenFiles([file], NO_KEYS, 10);

    expect(accepted).toEqual([file]);
    expect(rejected).toHaveLength(0);
  });

  it('rejects an unsupported type', () => {
    const { accepted, rejected } = screenFiles(
      [makeFile('doc.pdf', 'application/pdf')],
      NO_KEYS,
      10,
    );

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('type');
  });

  // The server declines WebP outright (see server/src/utils/imageType.ts), so the
  // client must not let one through and earn a 415.
  it('rejects WebP, which the server does not accept', () => {
    const { accepted, rejected } = screenFiles([makeFile('a.webp', 'image/webp')], NO_KEYS, 10);

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('type');
  });

  // Chrome and Firefox report an EMPTY file.type for .heic. A MIME-only check
  // would reject every photo straight off an iPhone — the exact bug this guards.
  it('accepts a HEIC whose MIME type the browser left blank', () => {
    const { accepted, rejected } = screenFiles([makeFile('IMG_6493.HEIC', '')], NO_KEYS, 10);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('accepts a HEIC that the browser did label', () => {
    const { accepted } = screenFiles([makeFile('a.heic', 'image/heic')], NO_KEYS, 10);

    expect(accepted).toHaveLength(1);
  });

  it('still rejects a non-image whose MIME type is blank', () => {
    const { accepted, rejected } = screenFiles([makeFile('archive.zip', '')], NO_KEYS, 10);

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('type');
  });

  it('rejects a file over the size limit', () => {
    const oversized = makeFile('huge.png', 'image/png', MAX_IMAGE_BYTES + 1);
    const { accepted, rejected } = screenFiles([oversized], NO_KEYS, 10);

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('size');
  });

  it('rejects a file already in the set', () => {
    const file = makeFile('selfie.jpg', 'image/jpeg');
    const { accepted, rejected } = screenFiles([file], new Set([fileKey(file)]), 10);

    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe('duplicate');
  });

  it('rejects a duplicate that appears twice within the same batch', () => {
    // The first copy is accepted; the second collides with it, not with the set.
    const first = makeFile('selfie.jpg', 'image/jpeg');
    const second = makeFile('selfie.jpg', 'image/jpeg');
    const { accepted, rejected } = screenFiles([first, second], NO_KEYS, 10);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('duplicate');
  });

  it('fills the remaining slots in pick order and refuses the overflow', () => {
    const files = [
      makeFile('a.jpg', 'image/jpeg', 1024, 1),
      makeFile('b.jpg', 'image/jpeg', 1024, 2),
      makeFile('c.jpg', 'image/jpeg', 1024, 3),
    ];
    const { accepted, rejected } = screenFiles(files, NO_KEYS, 2);

    expect(accepted.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBe('full');
    expect(rejected[0].file.name).toBe('c.jpg');
  });

  it('reports every reason in one pass rather than stopping at the first bad file', () => {
    const { accepted, rejected } = screenFiles(
      [
        makeFile('good.jpg', 'image/jpeg'),
        makeFile('bad.gif', 'image/gif'),
        makeFile('big.png', 'image/png', MAX_IMAGE_BYTES + 1),
      ],
      NO_KEYS,
      10,
    );

    expect(accepted).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual(['type', 'size']);
  });
});

describe('fileKey', () => {
  it('distinguishes two files that differ only by modification time', () => {
    expect(fileKey(makeFile('a.jpg', 'image/jpeg', 1024, 1))).not.toBe(
      fileKey(makeFile('a.jpg', 'image/jpeg', 1024, 2)),
    );
  });
});

describe('formatBytes', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});
