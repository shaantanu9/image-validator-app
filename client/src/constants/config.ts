export const APP_CONFIG = {
  // Single source of truth for the app name — the scaffold's `--name` flag
  // rewrites this, and every user-facing surface (title, PWA manifest, navbar,
  // home hero) reads from it, so renaming the app happens in one place.
  name: 'Image Validator',
  description: 'Image Validator — Next.js client and Express API on PostgreSQL',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5012/api/v1',
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
    maxLimit: 100,
  },
} as const;
