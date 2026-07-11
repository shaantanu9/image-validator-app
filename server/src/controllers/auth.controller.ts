import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { RegisterInput, LoginInput, RefreshTokenInput } from '../validations/auth.schema';
import { UpdateUserInput } from '../validations/user.schema';
import { audit, AuditEvent } from '../utils/audit';

// Every /me route sits behind `authMiddleware`, so `req.user` is always set here.
// This narrows the type without a non-null assertion, and fails loudly (401 rather
// than a 500 on `undefined.userId`) if a route is ever mounted without the guard.
const requireUserId = (req: Request): string => {
  if (!req.user) {
    throw ApiError.unauthorized(MESSAGES.UNAUTHORIZED);
  }
  return req.user.userId;
};

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input);

  audit(AuditEvent.AUTH_REGISTER, {
    actorId: result.user.id,
    ip: req.ip,
    requestId: req.id,
    outcome: 'success',
  });

  res.status(201).json(new ApiResponse(MESSAGES.REGISTER_SUCCESS, result));
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as LoginInput;

  try {
    const result = await authService.login(input);

    audit(AuditEvent.AUTH_LOGIN_SUCCESS, {
      actorId: result.user.id,
      ip: req.ip,
      requestId: req.id,
      outcome: 'success',
    });

    res.status(200).json(new ApiResponse(MESSAGES.LOGIN_SUCCESS, result));
  } catch (error) {
    audit(AuditEvent.AUTH_LOGIN_FAILURE, {
      email: input.email,
      ip: req.ip,
      requestId: req.id,
      outcome: 'failure',
    });
    throw error;
  }
});

export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as RefreshTokenInput;
  const result = await authService.refreshAccessToken(input);

  audit(AuditEvent.AUTH_TOKEN_REFRESH, { ip: req.ip, requestId: req.id, outcome: 'success' });

  res.status(200).json(new ApiResponse(MESSAGES.TOKEN_REFRESH_SUCCESS, result));
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  const userId = req.user?.userId;

  if (userId) {
    await authService.logout(userId, refreshToken);
  }

  audit(AuditEvent.AUTH_LOGOUT, { actorId: userId, ip: req.ip, requestId: req.id });

  res.status(200).json(new ApiResponse(MESSAGES.LOGOUT_SUCCESS, null));
});

export const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await userService.findUserById(requireUserId(req));

  res.status(200).json(new ApiResponse(MESSAGES.SUCCESS, user));
});

export const updateMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const input = req.body as UpdateUserInput;
  const userId = requireUserId(req);

  const user = await userService.updateUser(userId, input);

  audit(AuditEvent.USER_UPDATED, {
    actorId: userId,
    targetId: userId,
    ip: req.ip,
    requestId: req.id,
    outcome: 'success',
  });

  res.status(200).json(new ApiResponse(MESSAGES.UPDATED, user));
});

export const deleteMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);

  await userService.deleteUser(userId);
  await authService.logout(userId, (req.body as { refreshToken?: string }).refreshToken);

  audit(AuditEvent.USER_DELETED, {
    actorId: userId,
    targetId: userId,
    ip: req.ip,
    requestId: req.id,
    outcome: 'success',
  });

  res.status(204).send();
});
