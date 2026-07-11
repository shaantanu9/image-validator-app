import api from '@/lib/api';
import type { ApiSuccessResponse } from '@/types/api';
import type { ImageRecord, UploadResult } from '@/types/images';

/**
 * Face detection costs ~60ms per image and the model has to be warm, so an upload
 * can comfortably outrun the client's default 10s timeout. Give it two minutes.
 */
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * Upload 1..N photos for validation.
 *
 * The server runs all six rules and answers **200 with a verdict per file**, split
 * into accepted/rejected — a rejected PHOTO is not a failed REQUEST, so this does
 * not throw for a blurry or duplicate image. It throws only for a genuine
 * transport/auth failure.
 */
export const uploadImages = async (
  files: File[],
  onProgress?: (percent: number) => void,
): Promise<UploadResult> => {
  const form = new FormData();
  for (const file of files) form.append('images', file);

  const { data } = await api.post<ApiSuccessResponse<UploadResult>>('/images', form, {
    // Let the browser set the multipart boundary — hardcoding the Content-Type
    // here omits it and the server cannot parse the body.
    headers: { 'Content-Type': undefined },
    timeout: UPLOAD_TIMEOUT_MS,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  return data.data;
};

export const listImages = async (status?: 'ACCEPTED' | 'REJECTED'): Promise<ImageRecord[]> => {
  const { data } = await api.get<ApiSuccessResponse<ImageRecord[]>>('/images', {
    params: status ? { status } : undefined,
  });
  return data.data;
};

export const deleteImage = async (id: string): Promise<void> => {
  await api.delete(`/images/${id}`);
};
