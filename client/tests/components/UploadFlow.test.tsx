import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/(protected)/dashboard/page';
import * as imagekit from '@/lib/imagekit';

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

vi.mock('@/lib/imagekit', () => ({ uploadImage: vi.fn() }));

const uploadImage = vi.mocked(imagekit.uploadImage);

const photo = (name: string, lastModified: number, type = 'image/jpeg') =>
  new File([new Uint8Array(64)], name, { type, lastModified });

const pick = (files: File[]) =>
  fireEvent.change(screen.getByTestId('photo-input'), { target: { files } });

describe('Upload flow (/dashboard)', () => {
  beforeEach(() => {
    // jsdom has no object-URL implementation, and the queue creates one per photo.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();

    uploadImage.mockReset();
    uploadImage.mockImplementation(async (file) => ({
      url: `https://cdn.example/${file.name}`,
      fileId: file.name,
      name: file.name,
    }));
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

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    // Two stored, so the set is still short of the six-photo minimum.
    expect(screen.getByText(/4 more photos to reach the 6-photo minimum/i)).toBeInTheDocument();
  });

  it('declares the set ready once six photos are stored', async () => {
    render(<DashboardPage />);

    pick(Array.from({ length: 6 }, (_, i) => photo(`p${i}.jpg`, i)));

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(6));
    await waitFor(() => expect(screen.getByText(/your set is ready/i)).toBeInTheDocument());
  });

  it('refuses a file the server would reject, and says why, without uploading it', async () => {
    render(<DashboardPage />);

    pick([photo('notes.pdf', 1, 'application/pdf')]);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not added/i);
    expect(screen.getByText(/isn’t a supported image/i)).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('refuses the same photo twice', async () => {
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));

    pick([photo('a.jpg', 1)]);

    expect(await screen.findByText(/already added this photo/i)).toBeInTheDocument();
    // Still only the one upload — the duplicate never left the browser.
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed upload and can retry it', async () => {
    uploadImage.mockRejectedValueOnce(new Error('Network error'));
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);

    const retry = await screen.findByRole('button', { name: /retry a\.jpg/i });
    expect(screen.getByText('Network error')).toBeInTheDocument();

    // The retry goes back to the server, and the photo lands.
    uploadImage.mockResolvedValueOnce({ url: 'https://cdn/a', fileId: 'a', name: 'a.jpg' });
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
  });

  it('removes a photo from the set', async () => {
    render(<DashboardPage />);

    pick([photo('a.jpg', 1)]);
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /remove a\.jpg/i }));

    await waitFor(() => expect(screen.queryByText('a.jpg')).not.toBeInTheDocument());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('stops at ten photos and refuses the overflow', async () => {
    render(<DashboardPage />);

    pick(Array.from({ length: 11 }, (_, i) => photo(`p${i}.jpg`, i)));

    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(10));
    expect(screen.getByText(/you can upload 10 photos/i)).toBeInTheDocument();
    expect(screen.getByTestId('photo-input')).toBeDisabled();
  });
});
