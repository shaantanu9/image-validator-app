import { randomUUID } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { appConfig } from '../config/app.config';

export interface TokenPayload {
  userId: string;
  email: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, appConfig.auth.accessTokenSecret, {
    expiresIn: appConfig.auth.accessTokenExpiry as SignOptions['expiresIn'],
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  // `jwtid` adds a unique `jti` claim so every refresh token is distinct, even
  // when issued in the same second — required for rotation to produce a new token.
  return jwt.sign(payload, appConfig.auth.refreshTokenSecret, {
    expiresIn: appConfig.auth.refreshTokenExpiry as SignOptions['expiresIn'],
    jwtid: randomUUID(),
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, appConfig.auth.accessTokenSecret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, appConfig.auth.refreshTokenSecret) as TokenPayload;
};
