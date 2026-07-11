import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { HTTP_STATUS } from '../constants/httpStatus';
import { isAcceptedFormat, sniffImageFormat } from '../utils/imageType';
import { HeicDecodeError, toDecodable } from '../lib/heic';
import { isImageKitConfigured, uploadToImageKit } from '../services/upload.service';
import logger from '../utils/logger';

// POST /uploads/image — multipart, field "image". The browser sends the file to
// us; multer buffers it; we validate the REAL bytes, then push them to ImageKit
// server-side. Layer order: rate-limit → multer → this handler.
export const uploadImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!isImageKitConfigured()) {
    throw ApiError.serviceUnavailable(MESSAGES.IMAGEKIT_NOT_CONFIGURED);
  }

  const file = req.file;
  if (!file) {
    throw ApiError.badRequest(MESSAGES.NO_FILE_UPLOADED);
  }

  // Trust the bytes, not the client's Content-Type / filename. The sniffer names
  // what it found, so an unsupported format can be reported precisely.
  const format = sniffImageFormat(file.buffer);
  if (!isAcceptedFormat(format)) {
    throw ApiError.unsupportedMediaType(
      format
        ? `${format.toUpperCase()} is not supported. ${MESSAGES.IMAGE_INVALID_TYPE}`
        : MESSAGES.IMAGE_INVALID_TYPE,
    );
  }

  // HEIC cannot be decoded by sharp, so it is transcoded to JPEG here — once, at
  // the ingest seam. Everything downstream sees ordinary, decodable bytes.
  let decodable;
  try {
    decodable = await toDecodable(file.buffer, format);
  } catch (err) {
    if (err instanceof HeicDecodeError) {
      throw ApiError.badRequest(`Could not read the HEIC image. ${err.message}`);
    }
    throw err;
  }

  // A transcoded HEIC is stored as the JPEG we produced, not the original bytes.
  const ext = decodable.transcoded || format === 'jpeg' ? 'jpg' : 'png';
  const fileName = `${req.user?.userId ?? 'anon'}-${Date.now()}.${ext}`;

  try {
    const result = await uploadToImageKit(decodable.buffer, fileName);
    res.status(HTTP_STATUS.CREATED).json(new ApiResponse(MESSAGES.UPLOAD_SUCCESS, result));
  } catch (err) {
    // Don't leak ImageKit's raw response to the client; log it, answer a clean error.
    logger.error('ImageKit upload failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw ApiError.serviceUnavailable(MESSAGES.UPLOAD_FAILED);
  }
});
