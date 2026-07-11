import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { validationConfig } from '../../../src/config/validation.config';
import { validateFile, type DetectedFace, type FaceDetector } from '../../../src/lib/validateFile';

const fixture = (n: string): Buffer => readFileSync(join(__dirname, '../../fixtures', n));

const PORTRAIT = fixture('portrait.jpg'); // 900x1200, one real face
const HEIC = fixture('portrait.heic'); // 474x843, genuine Apple HEIC

// ---------------------------------------------------------------------------
// The detector is INJECTED, so every gate below is tested in milliseconds against
// a fake — no tfjs, no 5.4 MB of weights, no 60 ms of inference per case. The real
// adapter is exercised by the integration suite.
// ---------------------------------------------------------------------------
const face = (
  over: Partial<DetectedFace> & { size?: number; at?: [number, number] } = {},
): DetectedFace => {
  const size = over.size ?? 400;
  const [cx, cy] = over.at ?? [450, 500];
  // 68 landmarks: a jaw arc (0-16), then brows (17-26), then the rest.
  const landmarks = Array.from({ length: 68 }, (_, i) => {
    if (i < 17) return { x: cx - size / 2 + (i / 16) * size, y: cy + size / 3 }; // jaw
    if (i < 27) return { x: cx - size / 2 + ((i - 17) / 9) * size, y: cy - size / 3 }; // brows
    return { x: cx, y: cy };
  });
  return {
    box: { x: cx - size / 2, y: cy - size / 2, width: size, height: size },
    score: over.score ?? 0.99,
    landmarks: over.landmarks ?? landmarks,
  };
};

const detectOne: FaceDetector = async () => [face()];
const detectNone: FaceDetector = async () => [];
const detectTwo: FaceDetector = async () => [face({ at: [300, 500] }), face({ at: [700, 500] })];
const detectTiny: FaceDetector = async () => [face({ size: 40 })];
const detectLowScore: FaceDetector = async () => [face({ score: 0.35 })];

const expectReject = (v: Awaited<ReturnType<typeof validateFile>>, reason: string): void => {
  expect(v.ok).toBe(false);
  if (!v.ok) expect(v.reason).toBe(reason);
};

describe('validateFile — rule 2: format', () => {
  it('rejects a non-image outright', async () => {
    const v = await validateFile(Buffer.alloc(5000, 7), detectOne);
    expectReject(v, 'UNSUPPORTED_FORMAT');
  });

  it('rejects WebP — the spec allows JPG, PNG and HEIC only', async () => {
    const webp = await sharp(PORTRAIT).webp().toBuffer();
    const v = await validateFile(webp, detectOne);
    expectReject(v, 'UNSUPPORTED_FORMAT');
    if (!v.ok) expect(v.detail).toBe('webp');
  });

  it('ACCEPTS a real Apple HEIC — transcoding it first', async () => {
    const v = await validateFile(HEIC, detectOne, { ...validationConfig, faceMinPixels: 50 });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.metrics.format).toBe('heic');
      expect(v.metrics.transcoded).toBe(true);
      // The bytes handed on are the DECODABLE JPEG, not the original HEVC.
      expect((await sharp(v.buffer).metadata()).format).toBe('jpeg');
    }
  });
});

describe('validateFile — rule 1: too small', () => {
  it('rejects a tiny file by BYTES', async () => {
    const v = await validateFile(Buffer.from([0xff, 0xd8, 0xff, 0x00]), detectOne);
    expectReject(v, 'FILE_TOO_SMALL');
  });

  it('rejects a low RESOLUTION image', async () => {
    const small = await sharp(PORTRAIT).resize({ width: 100 }).jpeg().toBuffer();
    const v = await validateFile(small, detectOne, { ...validationConfig, minBytes: 100 });
    expectReject(v, 'RESOLUTION_TOO_SMALL');
  });

  it('rejects on resolution WITHOUT ever calling the face detector', async () => {
    // The whole point of cheapest-first: face detection is 1422x the cost of the
    // gates above it. If this ever regresses, the pipeline silently gets 60ms slower
    // per junk file.
    let called = 0;
    const spy: FaceDetector = async () => {
      called++;
      return [face()];
    };
    const small = await sharp(PORTRAIT).resize({ width: 100 }).jpeg().toBuffer();
    await validateFile(small, spy, { ...validationConfig, minBytes: 100 });
    expect(called).toBe(0);
  });
});

describe('validateFile — rule 4: blurry', () => {
  it('rejects a flat image on the whole-frame FLOOR, before face detection', async () => {
    let called = 0;
    const spy: FaceDetector = async () => {
      called++;
      return [face()];
    };
    const flat = await sharp({
      create: { width: 800, height: 800, channels: 3, background: '#808080' },
    })
      .jpeg()
      .toBuffer();

    const v = await validateFile(flat, spy, { ...validationConfig, minBytes: 100 });
    expectReject(v, 'BLURRY');
    expect(called).toBe(0); // never paid for the model
  });

  it('rejects a blurred face on the FACE-BOX gate', async () => {
    const blurred = await sharp(PORTRAIT).blur(8).jpeg().toBuffer();
    const v = await validateFile(blurred, detectOne, {
      ...validationConfig,
      frameSharpnessMin: 0, // force it past the floor so the FACE gate is what fires
    });
    expectReject(v, 'BLURRY');
    if (!v.ok) expect(v.detail).toMatch(/face sharpness/);
  });

  it('accepts a sharp photo', async () => {
    const v = await validateFile(PORTRAIT, detectOne);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.metrics.faceSharpness).toBeGreaterThan(validationConfig.faceSharpnessMin);
      expect(v.metrics.pHash).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});

describe('validateFile — rules 5 & 6: faces', () => {
  it('rejects when no face is found', async () => {
    expectReject(await validateFile(PORTRAIT, detectNone), 'NO_FACE');
  });

  it('rejects MULTIPLE faces', async () => {
    const v = await validateFile(PORTRAIT, detectTwo);
    expectReject(v, 'MULTIPLE_FACES');
    if (!v.ok) expect(v.detail).toContain('2');
  });

  it('rejects a face that is too small in PIXELS', async () => {
    const v = await validateFile(PORTRAIT, detectTiny);
    expectReject(v, 'FACE_TOO_SMALL');
  });

  it('rejects a face that is too small as a SHARE OF THE FRAME', async () => {
    const v = await validateFile(PORTRAIT, detectOne, {
      ...validationConfig,
      faceMinAreaRatio: 0.95, // impossible to satisfy
    });
    expectReject(v, 'FACE_TOO_SMALL');
    if (!v.ok) expect(v.detail).toContain('% of frame');
  });

  it('a small face is reported as FACE_TOO_SMALL, never laundered as NO_FACE', async () => {
    // A weak/small detection below the confidence bar must still be reported
    // honestly. Saying NO_FACE when a face WAS seen is a claim the code cannot
    // support, and the user cannot act on it.
    const detectTinyLowScore: FaceDetector = async () => [face({ size: 40, score: 0.35 })];
    const v = await validateFile(PORTRAIT, detectTinyLowScore);
    expectReject(v, 'FACE_TOO_SMALL');
  });

  it('a low-confidence but LARGE detection is NO_FACE (nothing credible was seen)', async () => {
    expectReject(await validateFile(PORTRAIT, detectLowScore), 'NO_FACE');
  });

  it('a small background face does not reject an otherwise good photo', async () => {
    // Filter by size FIRST, then count. Otherwise a 40px face on a poster in the
    // background trips MULTIPLE_FACES and rejects a perfect selfie.
    const withBystander: FaceDetector = async () => [face(), face({ size: 40, at: [80, 80] })];
    const v = await validateFile(PORTRAIT, withBystander);
    expect(v.ok).toBe(true);
  });
});

describe('validateFile — safety', () => {
  it('does NOT decide DUPLICATE — that is a cross-file decision, made serially', async () => {
    // Proving the seam: the same buffer twice always yields ok. Rule 3 is
    // reconcileDuplicates' job, precisely so it cannot race under Promise.allSettled.
    const a = await validateFile(PORTRAIT, detectOne);
    const b = await validateFile(PORTRAIT, detectOne);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it('STRIPS EXIF from the stored bytes — GPS never reaches storage', async () => {
    // Build a JPEG carrying a real EXIF payload, and prove it is there first —
    // otherwise this test could pass against an image that never had EXIF at all.
    const tagged = await sharp(PORTRAIT)
      .withExif({ IFD0: { Copyright: 'SECRET-GPS-PAYLOAD' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    expect(tagged.includes('SECRET-GPS-PAYLOAD')).toBe(true);

    const v = await validateFile(tagged, detectOne);
    expect(v.ok).toBe(true);
    if (!v.ok) return;

    // The bytes we would PERSIST carry no EXIF block...
    expect((await sharp(v.buffer).metadata()).exif).toBeUndefined();
    // ...and the secret string is not hiding anywhere in them.
    expect(v.buffer.includes('SECRET-GPS-PAYLOAD')).toBe(false);
  });

  it('REGRESSION: withMetadata({exif:{}}) does NOT strip — it retains', async () => {
    // Pinning the trap that makes the line above necessary. sharp strips by DEFAULT;
    // `withMetadata()` ENABLES retention. The "privacy" one-liner is the bug.
    const tagged = await sharp(PORTRAIT)
      .withExif({ IFD0: { Copyright: 'SECRET-GPS-PAYLOAD' } })
      .jpeg()
      .toBuffer();

    const wrong = await sharp(tagged).rotate().withMetadata({ exif: {} }).jpeg().toBuffer();
    expect((await sharp(wrong).metadata()).exif).toBeDefined(); // EXIF SURVIVED

    const right = await sharp(tagged).rotate().jpeg().toBuffer();
    expect((await sharp(right).metadata()).exif).toBeUndefined(); // stripped
  });
});
