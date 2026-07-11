import type { ImageStatus } from '@prisma/client';
import type { Request, Response } from 'express';

import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants/httpStatus';
import { copyFor } from '../constants/rejectionCopy';
import * as imageService from '../services/image.service';
import type { ImageRecord } from '../database/repositories/image.repository';

/**
 * Project the row for the client. Never ship internal columns wholesale.
 *
 * A rejected row carries BOTH the machine code and the human copy:
 *
 *   reason  — 'FACE_TOO_SMALL'. Stable. Branch on this.
 *   label   — 'Face is too far away'. Renders under the thumbnail.
 *   message — the explanation, for the hover tooltip. Tells the user what to DO.
 *   action  — 'crop' | 'replace'. Whether this photo is salvageable by re-framing,
 *             so the client knows whether to offer a Crop affordance.
 *
 * Shipping the prose from the server keeps the wording and the rule that produced
 * it in one place; a client-side code->string map is how those two drift apart.
 */
const present = (r: ImageRecord): Record<string, unknown> => ({
  id: r.id,
  originalName: r.originalName,
  status: r.status,
  ...(r.status === 'REJECTED'
    ? {
        reason: r.rejectionReason,
        detail: r.rejectionDetail,
        ...copyFor(r.rejectionReason ?? ''),
      }
    : {
        url: r.storageUrl,
        format: r.format,
        transcoded: r.transcoded,
        width: r.width,
        height: r.height,
        bytes: r.bytes,
        faceSharpness: r.faceSharpness,
        faceBox: r.faceBox,
      }),
  createdAt: r.createdAt,
});

/**
 * POST /api/v1/images  — multipart, field "images", 1..20 files.
 *
 * Answers 200, not 4xx, when some files are rejected: a rejected PHOTO is not a
 * failed REQUEST. Every file gets its own verdict, split into accepted/rejected.
 * Only a request carrying no files at all is a 400.
 */
export const uploadImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw ApiError.badRequest('Attach at least one image.');

  const ownerId = req.user!.userId;

  const { accepted, rejected } = await imageService.uploadImages(
    ownerId,
    files.map((f) => ({ originalName: f.originalname, buffer: f.buffer })),
  );

  res.status(HTTP_STATUS.OK).json(
    new ApiResponse('Upload processed.', {
      accepted: accepted.map(present),
      rejected: rejected.map(present),
      meta: {
        total: files.length,
        accepted: accepted.length,
        rejected: rejected.length,
      },
    }),
  );
});

/** GET /api/v1/images?status=ACCEPTED|REJECTED — owner-scoped. */
export const listImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Express yields an ARRAY for `?status=a&status=b`, and `.toUpperCase()` on an
  // array throws — a 500 on what is really a malformed request. Reject it as the
  // ambiguous input it is, rather than silently honouring one value and dropping
  // the other.
  const raw = req.query['status'];
  if (Array.isArray(raw)) {
    throw ApiError.badRequest('Provide status once.');
  }

  const status = typeof raw === 'string' ? raw.toUpperCase() : undefined;
  if (status && status !== 'ACCEPTED' && status !== 'REJECTED') {
    throw ApiError.badRequest('status must be ACCEPTED or REJECTED.');
  }

  const rows = await imageService.listImages(req.user!.userId, status as ImageStatus | undefined);
  res.status(HTTP_STATUS.OK).json(new ApiResponse('Images fetched.', rows.map(present)));
});

/** GET /api/v1/images/:id — someone else's id is a 404, never a 403. */
export const getImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const row = await imageService.getImage(req.params['id'], req.user!.userId);
  res.status(HTTP_STATUS.OK).json(new ApiResponse('Image fetched.', present(row)));
});

/** DELETE /api/v1/images/:id */
export const deleteImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await imageService.deleteImage(req.params['id'], req.user!.userId);
  res.status(HTTP_STATUS.NO_CONTENT).send();
});
