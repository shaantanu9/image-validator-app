import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUploadQueue } from '@/hooks/useUploadQueue';
import { MAX_PHOTOS } from '@/constants/upload';
import type { AcceptedImage, RejectedImage, UploadResult } from '@/types/images';

// The hook talks to the server through @/lib/images only, so that is the seam.
vi.mock('@/lib/images', () => ({
  uploadImages: vi.fn(),
  listImages: vi.fn(),
  deleteImage: vi.fn(),
}));

import { deleteImage, listImages, uploadImages } from '@/lib/images';

const mockUpload = vi.mocked(uploadImages);
const mockList = vi.mocked(listImages);
const mockDelete = vi.mocked(deleteImage);

const jpeg = (name: string): File =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(2048).fill(0)])], name, {
    type: 'image/jpeg',
  });

const accepted = (name: string, id = 'srv-' + name): AcceptedImage => ({
  id,
  originalName: name,
  status: 'ACCEPTED',
  url: `https://cdn.test/${id}.jpg`,
  format: 'jpeg',
  transcoded: false,
  width: 900,
  height: 1200,
  bytes: 2048,
  faceSharpness: 500,
  faceBox: { left: 1, top: 1, width: 10, height: 10 },
  createdAt: new Date().toISOString(),
});

const rejected = (name: string, id = 'srv-' + name): RejectedImage => ({
  id,
  originalName: name,
  status: 'REJECTED',
  reason: 'BLURRY',
  detail: 'face sharpness 7.1 < 60',
  label: 'Blurry face detected',
  message: 'This photo is not sharp enough around the face.',
  action: 'replace',
  createdAt: new Date().toISOString(),
});

const result = (a: AcceptedImage[], r: RejectedImage[]): UploadResult => ({
  accepted: a,
  rejected: r,
  meta: { total: a.length + r.length, accepted: a.length, rejected: r.length },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([]);
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
});

describe('useUploadQueue — slot accounting', () => {
  it('a REJECTED photo does NOT consume a slot', async () => {
    // The bug: 9 accepted + 1 rejected read as "10 of 10, full", and the dropzone
    // refused new files — locking the user out of replacing the very photo the UI
    // was asking them to replace.
    mockUpload.mockImplementation(async (files) => {
      const name = files[0]!.name;
      return name === 'bad.jpg'
        ? result([], [rejected(name)])
        : result([accepted(name)], []);
    });

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() => hook.current.addFiles([jpeg('good.jpg'), jpeg('bad.jpg')]));
    await waitFor(() => expect(hook.current.isUploading).toBe(false), { timeout: 3000 });

    expect(hook.current.uploaded).toBe(1);
    expect(hook.current.rejectedPhotos).toHaveLength(1);

    // Only the ACCEPTED photo holds a slot.
    expect(hook.current.occupied).toBe(1);
    expect(hook.current.remainingSlots).toBe(MAX_PHOTOS - 1);
    expect(hook.current.isFull).toBe(false);
  });

  it('the set is full only when ACCEPTED + in-flight photos reach the cap', async () => {
    mockUpload.mockImplementation(async (files) =>
      result([accepted(files[0]!.name)], []),
    );

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() =>
      hook.current.addFiles(Array.from({ length: MAX_PHOTOS }, (_, i) => jpeg(`p${i}.jpg`))),
    );
    await waitFor(() => expect(hook.current.isUploading).toBe(false), { timeout: 8000 });

    expect(hook.current.uploaded).toBe(MAX_PHOTOS);
    expect(hook.current.isFull).toBe(true);
    expect(hook.current.remainingSlots).toBe(0);
  }, 15_000);
});

describe('useUploadQueue — hydration', () => {
  it('loads previously-stored photos on mount', async () => {
    // Without this, the page shows "0 of 10" while the account still holds photos —
    // and the duplicate rule then fires against images the user cannot see.
    mockList.mockResolvedValue([accepted('old.jpg'), rejected('old-bad.jpg')]);

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.uploaded).toBe(1);
    expect(hook.current.rejectedPhotos).toHaveLength(1);
    expect(hook.current.rejectedPhotos[0]!.label).toBe('Blurry face detected');
    // The stored photo holds a slot; the stored REJECTION does not.
    expect(hook.current.occupied).toBe(1);
  });

  it('a failed hydrate does not break the page', async () => {
    mockList.mockRejectedValue(new Error('network down'));

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    expect(hook.current.uploaded).toBe(0);
    expect(hook.current.isFull).toBe(false);
  });
});

describe('useUploadQueue — verdicts', () => {
  it('carries the SERVER copy for a rejection, not a client-side string map', async () => {
    mockUpload.mockResolvedValue(result([], [rejected('bad.jpg')]));

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() => hook.current.addFiles([jpeg('bad.jpg')]));
    await waitFor(() => expect(hook.current.rejectedPhotos).toHaveLength(1), { timeout: 3000 });

    const r = hook.current.rejectedPhotos[0]!;
    expect(r.reason).toBe('BLURRY'); // stable code — branch on this
    expect(r.label).toBe('Blurry face detected'); // rendered under the thumbnail
    expect(r.message).toMatch(/not sharp enough/); // rendered in the tooltip
    expect(r.action).toBe('replace');
  });

  it('uploads SEQUENTIALLY, so the first photo picked wins a duplicate contest', async () => {
    // Concurrent uploads race: the server accepts exactly one of two identical
    // photos, but WHICH one depends on arrival order. Observed at concurrency 3: a
    // user's ORIGINAL was rejected as a duplicate of its own downscaled copy.
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;

    mockUpload.mockImplementation(async (files) => {
      const name = files[0]!.name;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(name);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return result([accepted(name)], []);
    });

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() => hook.current.addFiles([jpeg('first.jpg'), jpeg('second.jpg'), jpeg('third.jpg')]));
    await waitFor(() => expect(hook.current.isUploading).toBe(false), { timeout: 5000 });

    expect(maxInFlight).toBe(1); // never concurrent
    expect(order).toEqual(['first.jpg', 'second.jpg', 'third.jpg']); // and in pick order
  });

  it('removing a photo deletes its SERVER row, not just the thumbnail', async () => {
    mockUpload.mockResolvedValue(result([accepted('good.jpg', 'srv-1')], []));
    mockDelete.mockResolvedValue(undefined);

    const { result: hook } = renderHook(() => useUploadQueue());
    await waitFor(() => expect(hook.current.isLoading).toBe(false));

    act(() => hook.current.addFiles([jpeg('good.jpg')]));
    await waitFor(() => expect(hook.current.uploaded).toBe(1), { timeout: 3000 });

    const id = hook.current.photos[0]!.id;
    act(() => hook.current.remove(id));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('srv-1'));
    expect(hook.current.uploaded).toBe(0);
    expect(hook.current.remainingSlots).toBe(MAX_PHOTOS);
  });
});
