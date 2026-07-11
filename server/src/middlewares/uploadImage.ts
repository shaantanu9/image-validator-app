import multer, { MulterError, type Options } from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

// Max size a single image may be. Multer's `fileSize` is per-file; with `files: 1`
// it is also the whole-request bound, so no separate total-body guard is needed.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Harden every multer default that is a hole (see the express-multer-uploads skill):
// this endpoint takes ONE file in the `image` field and nothing else.
const limits: Options['limits'] = {
  fileSize: MAX_IMAGE_BYTES,
  files: 1,
  // busboy counts one more "part" than files, so a single file needs parts: 2.
  parts: 2,
  fields: 0,
  fieldNameSize: 100,
  fieldSize: 1024,
  headerPairs: 20,
};

// Bytes stay in memory so we can sniff magic bytes and hand the Buffer straight
// to ImageKit — the file never touches local disk.
const uploader = multer({ storage: multer.memoryStorage(), limits }).single('image');

// Translate multer's own errors (all of which are the CLIENT's fault) into typed
// ApiErrors, so the central handler answers 4xx instead of a generic 500 that
// leaks "MulterError" to the caller.
const translate = (err: MulterError): ApiError => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return ApiError.payloadTooLarge(MESSAGES.IMAGE_TOO_LARGE);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return ApiError.badRequest('Send exactly one image.');
    case 'LIMIT_UNEXPECTED_FILE':
      return ApiError.badRequest(`Unexpected file field "${err.field}". Use the "image" field.`);
    default:
      // Field-count / key / value / nesting limits, and anything @types/multer
      // does not yet know: answer 400 WITHOUT leaking the underlying message.
      return ApiError.badRequest(MESSAGES.NO_FILE_UPLOADED);
  }
};

// Route-level middleware: run multer, then normalise its errors. Mounted AFTER
// the upload rate limiter so a throttled caller is rejected before any byte is
// buffered.
export const uploadImage = (req: Request, res: Response, next: NextFunction): void => {
  uploader(req, res, (err: unknown) => {
    if (err instanceof MulterError) return next(translate(err));
    if (err) return next(err);
    next();
  });
};
