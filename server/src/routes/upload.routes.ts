import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import { uploadRateLimiter } from '../middlewares/rateLimiter';
import { uploadImage } from '../middlewares/uploadImage';

const router = Router();

router.use(authMiddleware);

// POST /uploads/image — multipart/form-data, field "image".
// Order: auth → rate-limit (before buffering) → multer → controller.
// The browser sends the file here; the server validates it and uploads it to
// ImageKit. The ImageKit private key never leaves the server.
router.post('/image', uploadRateLimiter, uploadImage, uploadController.uploadImage);

export default router;
