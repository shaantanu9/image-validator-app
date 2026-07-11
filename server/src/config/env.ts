import { cleanEnv, port, str, url, makeValidator } from 'envalid';

const minLengthString = (minLength: number) =>
  makeValidator<string>((input: string) => {
    if (typeof input !== 'string') {
      throw new Error(`Expected string, got ${typeof input}`);
    }
    if (input.length < minLength) {
      throw new Error(`String must be at least ${minLength} characters long`);
    }
    return input;
  });

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 5012 }),
  CLIENT_URL: url({ default: 'http://localhost:3100' }),
  API_PREFIX: str({ default: '/api/v1' }),
  DATABASE_URL: url(),
  REDIS_URL: url(),
  // Namespaces every BullMQ key. Dev, test and prod sharing one Redis share one
  // keyspace: a stray dev worker will otherwise consume a job your test enqueued.
  BULLMQ_PREFIX: str({ default: 'bull' }),
  ACCESS_TOKEN_SECRET: minLengthString(32)(),
  ACCESS_TOKEN_EXPIRY: str({ default: '15m' }),
  REFRESH_TOKEN_SECRET: minLengthString(32)(),
  REFRESH_TOKEN_EXPIRY: str({ default: '7d' }),
  LOG_LEVEL: str({
    choices: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
    default: 'info',
  }),
  // ImageKit (optional). Leave blank to disable image uploads — the auth
  // endpoint then returns 503 until these are set. See docs/manual-todo/imagekit-setup.md.
  IMAGEKIT_PUBLIC_KEY: str({ default: '' }),
  IMAGEKIT_PRIVATE_KEY: str({ default: '' }),
  IMAGEKIT_URL_ENDPOINT: str({ default: '' }),
});
