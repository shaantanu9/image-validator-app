import { Router } from 'express';

import * as imageController from '../controllers/image.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadRateLimiter } from '../middlewares/rateLimiter';
import { uploadImagesMiddleware } from '../middlewares/uploadImages';

const router = Router();

// Every path here is owner-scoped; there is no public read.
router.use(authMiddleware);

// The rate limiter guards the WRITE path ONLY.
//
// Mounting it on the whole router is the classic mistake: a client polling its own
// upload status every 2s needs 450 requests per 15 minutes just to IDLE, so a
// 30/15min limiter in front of the GETs would 429 the app against itself within a
// minute — and then block uploads for the remaining fourteen.
//
// It also sits BEFORE the multer middleware, so a throttled caller is rejected
// without buffering a single byte.
router.post('/', uploadRateLimiter, ...uploadImagesMiddleware, imageController.uploadImages);

// Reads: no upload limiter. (The global apiRateLimiter still applies.)
router.get('/', imageController.listImages);
router.get('/:id', imageController.getImage);
router.delete('/:id', imageController.deleteImage);

export default router;
