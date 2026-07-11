import { createHash } from 'crypto';
import { userRepository } from '../database/repositories';
import { redis } from '../database/redis';
import { ApiError } from '../utils/ApiError';
import { MESSAGES } from '../constants/messages';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  TokenPayload,
} from '../utils/jwt';
import { RegisterInput, LoginInput, RefreshTokenInput } from '../validations/auth.schema';
import { enqueueWelcomeEmail } from '../jobs/emailQueue';
import { appConfig } from '../config/app.config';
import logger from '../utils/logger';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Store only a hash of the refresh token as the Redis key so lookups are O(1)
// (no `redis.keys()` scan) and the raw token is never persisted server-side.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const getRefreshTokenKey = (userId: string, token: string): string => {
  return `${REFRESH_TOKEN_PREFIX}${userId}:${hashToken(token)}`;
};

const storeRefreshToken = async (userId: string, token: string): Promise<void> => {
  await redis.setex(getRefreshTokenKey(userId, token), REFRESH_TOKEN_TTL_SECONDS, '1');
};

// A unique-constraint violation from the driver:
// `P2002`, MongoDB/Mongoose reports numeric `11000`. Both mean "email taken".
const isUniqueViolation = (err: unknown): boolean => {
  const code = (err as { code?: string | number }).code;
  return code === 'P2002' || code === 11000;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  tokens: AuthTokens;
}

export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const existingUser = await userRepository.findByEmail(input.email);

  if (existingUser) {
    throw ApiError.conflict(MESSAGES.EMAIL_ALREADY_EXISTS);
  }

  const hashedPassword = await hashPassword(input.password);

  // The findByEmail check above is a fast path; this catch closes the race where
  // two concurrent registrations pass the check, so the loser gets 409 not 500.
  let user;
  try {
    user = await userRepository.create({
      email: input.email,
      password: hashedPassword,
      name: input.name,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.conflict(MESSAGES.EMAIL_ALREADY_EXISTS);
    }
    throw err;
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await storeRefreshToken(user.id, refreshToken);

  logger.info('User registered', { userId: user.id, email: user.email });

  // Hand the welcome email off to the background worker so registration returns
  // immediately. Best-effort: enqueue failures are swallowed inside the queue.
  // Skipped under NODE_ENV=test — the enqueue path is unit-tested directly in
  // emailQueue.test.ts, and touching the shared Redis on every register() would
  // otherwise race the per-test flushdb and flake the suite.
  if (!appConfig.isTest) {
    await enqueueWelcomeEmail({ userId: user.id, email: user.email });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tokens: { accessToken, refreshToken },
  };
};

export const login = async (input: LoginInput): Promise<AuthResponse> => {
  const user = await userRepository.findByEmail(input.email);

  if (!user || !user.isActive) {
    throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
  }

  const isPasswordValid = await comparePassword(input.password, user.password);

  if (!isPasswordValid) {
    throw ApiError.unauthorized(MESSAGES.INVALID_CREDENTIALS);
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await storeRefreshToken(user.id, refreshToken);

  logger.info('User logged in', { userId: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    tokens: { accessToken, refreshToken },
  };
};

export const refreshAccessToken = async (input: RefreshTokenInput): Promise<AuthTokens> => {
  let decoded: TokenPayload;

  try {
    decoded = verifyRefreshToken(input.refreshToken);
  } catch {
    throw ApiError.unauthorized(MESSAGES.INVALID_TOKEN);
  }

  // O(1) lookup: the presented token hashes directly to its Redis key.
  const currentKey = getRefreshTokenKey(decoded.userId, input.refreshToken);
  const exists = await redis.get(currentKey);

  if (!exists) {
    throw ApiError.unauthorized(MESSAGES.INVALID_TOKEN);
  }

  const payload: TokenPayload = {
    userId: decoded.userId,
    email: decoded.email,
  };

  // Rotation: invalidate the used refresh token and issue a fresh pair.
  await redis.del(currentKey);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  await storeRefreshToken(decoded.userId, refreshToken);

  return { accessToken, refreshToken };
};

export const logout = async (userId: string, refreshToken: string | undefined): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  await redis.del(getRefreshTokenKey(userId, refreshToken));

  logger.info('User logged out', { userId });
};
