import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Edge middleware built from the provider-less base config, so it stays
// Edge-compatible. The `authorized` callback (in auth.config.ts) does the
// public/protected routing: unauthenticated visitors to /dashboard or /profile
// are redirected to /login; authenticated visitors are kept off /login,/register.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/login', '/register'],
};
