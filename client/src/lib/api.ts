import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import { ApiErrorResponse } from '@/types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5012/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Attach the Express access token from the NextAuth session to every request.
// The session's token is kept fresh by the NextAuth `jwt` callback (auth.config.ts),
// which silently rotates it via the Express /refresh-token endpoint — so callers
// never touch tokens; they just use `api`.
api.interceptors.request.use(async (config) => {
  const session = await getSession();
  const token = session?.accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (token expired between session reads, or the session was revoked),
// hand re-authentication back to NextAuth: sign out and route to /login.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      await signOut({ redirectTo: '/login' });
    }
    return Promise.reject(error);
  },
);

// Turn a parsed error body into a human-readable message. The server answers a
// failed Zod validation with a generic `message` ("Validation error.") plus the
// real, per-field reasons in `errors` — so prefer those, and only fall back to
// `message` when there are no field errors. Transport-agnostic: works for both
// the axios `api` instance and raw `fetch` calls (e.g. the pre-session register
// request), so a validation failure never shows the useless generic text alone.
export const formatErrorBody = (
  body: Partial<ApiErrorResponse> | undefined,
  fallback = 'An unexpected error occurred',
): string => {
  if (body?.errors) {
    const fieldMessages = Object.values(body.errors).flat();
    if (fieldMessages.length > 0) {
      return fieldMessages.join(' ');
    }
  }
  return body?.message || fallback;
};

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    return formatErrorBody(axiosError.response?.data);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

export default api;
