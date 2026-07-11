import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/(protected)/dashboard/page';
import * as images from '@/lib/images';
import type { AcceptedImage, UploadResult } from '@/types/images';

// The page's only real dependencies are the session (for the top bar's sign-out)
// and the upload call. Everything else — screening, the queue, the counters — is
// the code under test, so it runs for real.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', userId: '1', email: 'user@example.com', name: 'User' },
    isAuthenticated: true,
    isLoading: false,
    hasHydrated: true,
    error: null,
    logout: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('@/lib/images', () => ({
  uploadImages: vi.fn(),
  listImages: vi.fn(),
  deleteImage: vi.fn(),
}));

const uploadImages = vi.mocked(images.uploadImages);
const listImages = vi.mocked(images.listImages);
const deleteImage = vi.mocked(images.deleteImage);

const photo = (name: string, lastModified: number, type = 'image/jpeg') =>
  new File([new Uint8Array(64)], name, { type, lastModified });

const pick = (files: File[]) =>
  fireEvent.change(screen.getByTestId('photo-input'), { target: { files } });

/** The server answers 200 with a verdict per file — one file in, one verdict out. */
const accepted = (file: File): AcceptedImage => ({
  id: file.name,
  originalName: file.name,
  status: 'ACCEPTED',
  url: `https://cdn.example/${file.name}`,
  format: 'jpeg',
  transcoded: false,
  width: 800,
  height: 800,
  bytes: file.size,
  faceSharpness: 120,
  faceBox: { left: 100, top: 100, width: 300, height: 300 },
  createdAt: new Date(0).toISOString(),
});

const verdict = (files: File[]): UploadResult => ({
  accepted: files.map(accepted),
  rejected: [],
  meta: { total: files.length, accepted: files.length, rejected: 0 },
});

describe('Upload flow (/dashboard)', () => {
  beforeEach(() => {
    // jsdom has no object-URL implementation, and the queue creates one per photo.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();

    uploadImages.mockReset();
    listImages.mockReset();
    deleteImage.mockReset();

    uploadImages.mockImplementation(async (files) => verdict(files));
    listImages.mockResolvedValue([]);
    deleteImage.mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts empty, with nothing uploaded', () => {
    render(<DashboardPage />);

    expect(screen.getByRole('heading', { name: 'Upload photos' })).toBeInTheDocument();
    expect(screen.getByText(/your photos will appear here/i)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('uploads picked photos and counts the ones the server stored', async () => {
    render(<DashboardPage />);

    pick([photo('a.jpg', 1), photo('b.jpg', 2)]);

    // Both rows appear immediately — before the network has done anything.
    expect(screen.getByText('a.jpg')).toBeInTheDocument();
    expect(screen.getByText('b.jpg')).toBeInTheDocument();

    await waitFor(() => expect(uploadImages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    // Two stored, so the set is still short of the six-photo minimum.
    expect(screen.getByText(/4 more photos to reach the 6-photo minimum/i)).toBeInTheDocument();
  });

  it('declares the set ready once six photos are stored', async () => {
    render(<DashboardPage />);

    pick(Array.from({ length: 6 }, (_, i) => photo(`p${i}.jpg`, i)));

    await waitFor(() => expect(uploadImages).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.getByText(/your set is ready/i)).toBeInTheDocument());
  });

  it('refuses a file the server would reject, and says why, without uploading it', async () => {
    render(<DashboardPage />);

    pick([photo('notes.pdf', 1, 'application/pdf')]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not added/i);
    expect(screen.getByText(/isn’t a supported image/i)).toBeInTheDocument();
    expect(uploadImages).not.toHaveBeenCalled();
  });

  it('refuses the same photo twice', async () => {
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);
    await waitFor(() => expect(uploadImages).toHaveBeenCalledTimes(1));

    pick([photo('a.jpg', 1)]);

    expect(await screen.findByText(/already added this photo/i)).toBeInTheDocument();
    // Still only the one upload — the duplicate never left the browser.
    expect(uploadImages).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed upload and can retry it', async () => {
    // A transport failure — NOT a rejected photo. Those come back as a 200 verdict.
    uploadImages.mockRejectedValueOnce(new Error('Network error'));
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);

    const retry = await screen.findByRole('button', { name: /retry a\.jpg/i });
    expect(screen.getByText('Network error')).toBeInTheDocument();

    // The retry goes back to the server (falling through to the default
    // implementation, which accepts), and the photo lands.
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  // Removing a stored photo must delete it on the SERVER too. If it only left local
  // state, the duplicate rule would keep matching a row the user believes is gone —
  // and they'd be told a brand-new photo is "too similar" to an invisible one.
  it('removes a photo from the set, and deletes it on the server', async () => {
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    // An accepted photo offers Remove in two places — the upload list on the left
    // and the grid on the right. Either one removes it; take the first.
    fireEvent.click(screen.getAllByRole('button', { name: /remove a\.jpg/i })[0]);

    await waitFor(() => expect(screen.queryByText('a.jpg')).not.toBeInTheDocument());
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith('a.jpg'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('stops at ten photos and refuses the overflow', async () => {
    render(<DashboardPage />);

    pick(Array.from({ length: 11 }, (_, i) => photo(`p${i}.jpg`, i)));

    await waitFor(() => expect(uploadImages).toHaveBeenCalledTimes(10));
    expect(screen.getByText(/you can upload 10 photos/i)).toBeInTheDocument();
    expect(screen.getByTestId('photo-input')).toBeDisabled();
  });
});
