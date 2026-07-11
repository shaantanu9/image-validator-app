import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middlewares/validateRequest';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validations/auth.schema';
import { updateUserSchema } from '../validations/user.schema';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh-token', validateBody(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authMiddleware, authController.logout);

// Self-service only: every /me route acts on the caller's own record, taken from
// the verified token — never from a client-supplied id. There is no user directory
// and no privileged role, so there is no path to read or mutate another account.
router.get('/me', authMiddleware, authController.getMe);
router.patch('/me', authMiddleware, validateBody(updateUserSchema), authController.updateMe);
router.delete('/me', authMiddleware, authController.deleteMe);

export default router;
