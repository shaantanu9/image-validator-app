import { env } from './env';

export const appConfig = {
  env: env.NODE_ENV,
  port: env.PORT,
  clientUrl: env.CLIENT_URL,
  apiPrefix: env.API_PREFIX,
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  isProduction: env.NODE_ENV === 'production',
  logLevel: env.LOG_LEVEL,
  auth: {
    accessTokenSecret: env.ACCESS_TOKEN_SECRET,
    accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
    refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
  },
  db: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
    bullmqPrefix: env.BULLMQ_PREFIX,
  },
  imagekit: {
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
  },
} as const;
