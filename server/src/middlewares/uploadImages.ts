import multer, { MulterError, type Options } from 'multer';
import type { Request, Response, NextFunction } from 'express';

import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { validationConfig } from '../config/validation.config';

/** Files per batch. */
const MAX_BATCH_FILES = 20;

/**
 * multer's `fileSize` is PER FILE, not per request. With 20 files allowed, the
 * parser alone would happily buffer 20 x 10 MB = 200 MB of RAM before any of our
 * code runs. multer cannot express a total-body bound, so we add one.
 */
const MAX_BATCH_TOTAL_BYTES = 50 * 1024 * 1024;

const limits: Options['limits'] = {
  fileSize: validationConfig.maxBytes,
  files: MAX_BATCH_FILES,
  // busboy counts one MORE "part" than there are files, so N files needs N + 1.
  // Setting `parts: MAX_BATCH_FILES` here silently rejects a legal 20-file upload.
  parts: MAX_BATCH_FILES + 1,
  fields: 0,
  fieldNameSize: 100,
  fieldSize: 1024,
  headerPairs: 20,
};

// memoryStorage: the bytes never touch local disk, so there is no path-traversal
// surface from `originalname` and nothing to clean up on a crash.
//
// NO `fileFilter`. On a BATCH endpoint a fileFilter error ABORTS THE WHOLE REQUEST
// — one bad file would kill nine good ones. Format is a per-file VERDICT here, not
// a parser error: it is decided in validateFile and reported as UNSUPPORTED_FORMAT.
const uploader = multer({ storage: multer.memoryStorage(), limits }).array(
  'images',
  MAX_BATCH_FILES,
);

const translate = (err: MulterError): ApiError => {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return ApiError.payloadTooLarge(MESSAGES.IMAGE_TOO_LARGE);
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_PART_COUNT':
      return ApiError.badRequest(`Send at most ${MAX_BATCH_FILES} images per request.`);
    case 'LIMIT_UNEXPECTED_FILE':
      return ApiError.badRequest(`Unexpected field "${err.field}". Use the "images" field.`);
    default:
      // Never leak multer's own wording to the client.
      return ApiError.badRequest(MESSAGES.NO_FILE_UPLOADED);
  }
};

/**
 * Reject an oversized batch BEFORE buffering it.
 *
 * The Content-Length fast path costs nothing. But a chunked request declares no
 * Content-Length at all, and a malicious one can LIE — so the byte counter below is
 * the real guard, and the header check is only an early-out.
 */
const guardTotalBytes = (req: Request, _res: Response, next: NextFunction): void => {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_BATCH_TOTAL_BYTES) {
    next(ApiError.payloadTooLarge('The batch is too large.'));
    return;
  }

  let seen = 0;
  const onData = (chunk: Buffer): void => {
    seen += chunk.length;
    if (seen > MAX_BATCH_TOTAL_BYTES) {
      req.removeListener('data', onData);
      req.destroy();
    }
  };
  req.on('data', onData);
  req.once('end', () => req.removeListener('data', onData));

  next();
};

const runMulter = (req: Request, res: Response, next: NextFunction): void => {
  uploader(req, res, (err: unknown) => {
    if (err instanceof MulterError) return next(translate(err));
    if (err) return next(err);
    next();
  });
};

export const uploadImagesMiddleware = [guardTotalBytes, runMulter];
