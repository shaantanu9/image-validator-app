import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(ApiError.unauthorized(MESSAGES.UNAUTHORIZED));
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch {
    next(ApiError.unauthorized(MESSAGES.INVALID_TOKEN));
  }
};
