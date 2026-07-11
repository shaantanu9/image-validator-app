import { appConfig } from '../config/app.config';

export interface ImageKitUploadResult {
  url: string;
  fileId: string;
  name: string;
  thumbnailUrl?: string;
  height?: number;
  width?: number;
  size?: number;
}

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

// Uploads are optional. When any ImageKit credential is missing, the endpoint
// returns 503 rather than attempting an upload that would fail with a raw error.
export const isImageKitConfigured = (): boolean =>
  Boolean(
    appConfig.imagekit.privateKey && appConfig.imagekit.publicKey && appConfig.imagekit.urlEndpoint,
  );

// Server-side upload: the browser sends the file to US (multer), we validate it,
// then WE push the bytes to ImageKit. The private key authenticates the request
// as HTTP Basic (username = private key, empty password) and never leaves the
// server. Returns the CDN URL the client stores/renders.
export const uploadToImageKit = async (
  file: Buffer,
  fileName: string,
  folder = '/uploads',
): Promise<ImageKitUploadResult> => {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(file)]), fileName);
  form.append('fileName', fileName);
  form.append('useUniqueFileName', 'true');
  form.append('folder', folder);

  const auth = Buffer.from(`${appConfig.imagekit.privateKey}:`).toString('base64');

  const res = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`ImageKit upload failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as ImageKitUploadResult;
};
