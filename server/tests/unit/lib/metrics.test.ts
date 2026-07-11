import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import {
  bandsOf,
  hamming,
  laplacianVariance,
  pHash,
  PHASH_ALGORITHM,
} from '../../../src/lib/metrics';

/** A deterministic, structured image — noise, so it has real high-frequency detail. */
const structured = async (seed = 1, size = 512): Promise<Buffer> => {
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const v = (Math.sin((x * seed) / 7) * 0.5 + Math.cos((y * seed) / 11) * 0.5) * 127 + 128;
    px[i * 3] = v;
    px[i * 3 + 1] = (v * 0.7) & 0xff;
    px[i * 3 + 2] = (v * 1.3) & 0xff;
  }
  return sharp(px, { raw: { width: size, height: size, channels: 3 } })
    .png()
    .toBuffer();
};

const flat = async (size = 512): Promise<Buffer> =>
  sharp({ create: { width: size, height: size, channels: 3, background: '#777' } })
    .png()
    .toBuffer();

describe('hamming', () => {
  it('is 0 for a hash against itself', () => {
    expect(hamming('70bd42d390c2cddc', '70bd42d390c2cddc')).toBe(0);
  });

  it('counts a known 1-bit difference as exactly 1', () => {
    // 0x0 -> 0x1 is a single bit.
    expect(hamming('0000000000000000', '0000000000000001')).toBe(1);
    // 0x0 -> 0xf is four bits.
    expect(hamming('0000000000000000', '000000000000000f')).toBe(4);
  });

  it('throws on a length mismatch rather than silently comparing garbage', () => {
    expect(() => hamming('abc', 'abcd')).toThrow(/length mismatch/);
  });
});

// Perceptual-hash behaviour is only meaningful on REAL photographs. A synthetic
// high-frequency pattern ALIASES under resampling, so it fails a resize test that a
// real photo passes at distance 2 — the fixture would be testing the sine wave, not
// the hash.
const PORTRAIT = readFileSync(join(__dirname, '../../fixtures/portrait.jpg'));
const OTHER_PORTRAIT = readFileSync(join(__dirname, '../../fixtures/portrait2.jpg'));

const DUP_THRESHOLD = 5;

describe('pHash (DCT, not average hash)', () => {
  it('produces 16 lowercase hex chars = 64 bits', async () => {
    expect(await pHash(PORTRAIT)).toMatch(/^[0-9a-f]{16}$/);
    expect(PHASH_ALGORITHM).toBe('dct64-median-v1');
  });

  it('is deterministic', async () => {
    expect(await pHash(PORTRAIT)).toBe(await pHash(PORTRAIT));
  });

  it('is SCALE-INVARIANT — the same photo at another resolution is a duplicate', async () => {
    // The point of a PERCEPTUAL hash. sha256 misses this entirely: different bytes,
    // same picture. Measured: 50% -> 2 bits, 25% -> 2 bits.
    const half = await sharp(PORTRAIT).resize({ width: 450 }).png().toBuffer();
    const quarter = await sharp(PORTRAIT).resize({ width: 225 }).png().toBuffer();
    const h = await pHash(PORTRAIT);
    expect(hamming(h, await pHash(half))).toBeLessThanOrEqual(DUP_THRESHOLD);
    expect(hamming(h, await pHash(quarter))).toBeLessThanOrEqual(DUP_THRESHOLD);
  });

  it('survives heavy JPEG recompression (q40) and a format change', async () => {
    const h = await pHash(PORTRAIT);
    const jpg40 = await sharp(PORTRAIT).jpeg({ quality: 40 }).toBuffer();
    const png = await sharp(PORTRAIT).png().toBuffer();
    expect(hamming(h, await pHash(jpg40))).toBeLessThanOrEqual(DUP_THRESHOLD);
    expect(hamming(h, await pHash(png))).toBeLessThanOrEqual(DUP_THRESHOLD);
  });

  it('SEPARATES two different photos far beyond the threshold', async () => {
    // Measured at 30 bits — six times the threshold. That gap is the safety margin,
    // and it is why the threshold is 5 on a DCT hash rather than 10 on an aHash
    // (whose nearest UNRELATED pair sits at 11, leaving one bit of headroom).
    const d = hamming(await pHash(PORTRAIT), await pHash(OTHER_PORTRAIT));
    expect(d).toBeGreaterThan(20);
  });

  it('does NOT survive a crop — a documented limitation, not a bug', async () => {
    // pHash is not a content ID. A user who crops and re-uploads WILL get past
    // dedup. Crop-invariance needs feature matching or a CNN embedding, which is out
    // of scope. Pinning it here so nobody later "fixes" it by loosening the
    // threshold — at a threshold loose enough to catch this, strangers collide.
    const cropped = await sharp(PORTRAIT).resize(256, 256).png().toBuffer(); // fit:cover crops
    const d = hamming(await pHash(PORTRAIT), await pHash(cropped));
    expect(d).toBeGreaterThan(DUP_THRESHOLD);
  });
});

describe('bandsOf', () => {
  it('splits into 4 namespaced bands', () => {
    expect(bandsOf('70bd42d390c2cddc')).toEqual(['0:70bd', '1:42d3', '2:90c2', '3:cddc']);
  });

  it('namespaces so the SAME nibbles in a DIFFERENT position do not match', () => {
    // Band 0 of one hash must never equal band 2 of another. Without the `i:`
    // prefix, '0:aaaa' and '2:aaaa' would both be the bare string 'aaaa' and the
    // GIN overlap query would return a false candidate.
    expect(bandsOf('aaaa000000000000')[0]).toBe('0:aaaa');
    expect(bandsOf('00000000aaaa0000')[2]).toBe('2:aaaa');
    expect(bandsOf('aaaa000000000000')[0]).not.toBe(bandsOf('00000000aaaa0000')[2]);
  });

  it('guarantees a shared band for any pair within Hamming distance 3 (pigeonhole)', () => {
    // 3 differing bits cannot touch all 4 bands, so at least one band is identical —
    // which is what makes the GIN prefilter safe to use instead of a full scan.
    const base = '0000000000000000';
    const near = '1110000000000000'; // 3 bits, all inside band 0
    expect(hamming(base, near)).toBeLessThanOrEqual(3);
    expect(bandsOf(base).some((x) => bandsOf(near).includes(x))).toBe(true);
  });
});

describe('laplacianVariance', () => {
  it('is a REAL variance — a flat image scores ~0', async () => {
    expect(await laplacianVariance(await flat())).toBeLessThan(1);
  });

  it('is much higher for a detailed image than a blurred copy of it', async () => {
    const sharpImg = await structured();
    const blurred = await sharp(sharpImg).blur(6).png().toBuffer();
    const s = await laplacianVariance(sharpImg);
    const b = await laplacianVariance(blurred);
    expect(s).toBeGreaterThan(b);
  });

  it('measures ONLY inside the box it is given', async () => {
    // Left half detailed, right half flat. Measuring each half must differ sharply.
    const size = 256;
    const px = Buffer.alloc(size * size * 3, 128);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size / 2; x++) {
        const v = (x + y) % 2 === 0 ? 0 : 255; // checkerboard = maximum detail
        const i = (y * size + x) * 3;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
      }
    }
    const img = await sharp(px, { raw: { width: size, height: size, channels: 3 } })
      .png()
      .toBuffer();

    const busy = await laplacianVariance(img, { left: 0, top: 0, width: 120, height: 120 });
    const calm = await laplacianVariance(img, { left: 130, top: 0, width: 120, height: 120 });

    expect(busy).toBeGreaterThan(1000);
    expect(calm).toBeLessThan(1);
  });
});
