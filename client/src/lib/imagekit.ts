import api from './api';
import { ApiSuccessResponse } from '@/types/api';

export interface ImageKitUploadResult {
  url: string;
  fileId: string;
  name: string;
  thumbnailUrl?: string;
}

interface UploadOptions {
  /** Abort the request — used when the user removes a photo mid-flight. */
  signal?: AbortSignal;
  /** 0–100. Only fires when the browser reports a total size. */
  onProgress?: (percent: number) => void;
}

/**
 * Upload an image through OUR backend, which validates it and pushes it to
 * ImageKit server-side. The ImageKit private key never reaches the browser and
 * the bytes are checked (type + size) before they are ever stored.
 *
 * POST multipart/form-data { image } → /uploads/image → { url, fileId, name }.
 * Throws if the server has no ImageKit config (503), the file is rejected
 * (400/413/415), or the upload fails.
 */
export const uploadImage = async (
  file: File,
  options: UploadOptions = {},
): Promise<ImageKitUploadResult> => {
  const form = new FormData();
  form.append('image', file);

  // The shared axios instance defaults Content-Type to application/json, which
  // would make axios JSON-serialize the FormData (sending `{"image":{}}` with no
  // file). Setting it to multipart/form-data makes axios emit the real multipart
  // body and append the boundary itself, so the server (multer) sees the file.
  const { data } = await api.post<ApiSuccessResponse<ImageKitUploadResult>>(
    '/uploads/image',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: options.signal,
      // The instance-wide 10s timeout is sized for JSON. A 5MB photo on a weak
      // connection legitimately takes longer, and timing that out would look
      // like a server fault to the user.
      timeout: 60_000,
      onUploadProgress: (event) => {
        if (!options.onProgress || !event.total) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    },
  );

  return data.data;
};
