import type { NextAuthConfig } from 'next-auth';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5012/api/v1';

const PROTECTED_PREFIXES = ['/dashboard', '/profile'];
const AUTH_PAGES = ['/login', '/register'];

// Edge-safe: decode a JWT's `exp` (ms) without verifying — the Express backend is
// the real verifier; we only need the expiry to know when to refresh. Uses `atob`
// (available in the Edge runtime) with a Node `Buffer` fallback.
const jwtExpiryMs = (token: string): number => {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json =
      typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    const exp = (JSON.parse(json) as { exp?: number }).exp;
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
};

// Shape of the fields we store on the NextAuth JWT (v5 types the callback token
// loosely, so we cast to this for typed reads/writes of our custom fields).
interface AppToken {
  sub?: string;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpires?: number;
  error?: string;
}

// Base config shared by the Edge middleware AND the full server auth. It carries
// NO provider with Node-only code, so it stays Edge-compatible for middleware.
// The Credentials provider (which calls the Express API) is added in auth.ts.
export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  // Per-app cookie name: stops a foreign localhost:3000 session cookie from
  // throwing `JWTSessionError: no matching decryption secret` here.
  cookies: { sessionToken: { name: 'image_validator.session-token' } },
  providers: [],
  callbacks: {
    // Route protection for the matcher routes (see middleware.ts).
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
      const isAuthPage = AUTH_PAGES.includes(pathname);

      // Unauthenticated on a protected page → false lets NextAuth redirect to the
      // signIn page (/login) with a callbackUrl.
      if (isProtected) return isLoggedIn;
      // Already authenticated on an auth page → bounce to the dashboard.
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    // Persist the Express tokens into the NextAuth JWT, and silently rotate
    // via the Express /refresh-token endpoint when the access token is near expiry.
    async jwt({ token, user }) {
      const t = token as AppToken;
      if (user) {
        t.accessToken = user.accessToken;
        t.refreshToken = user.refreshToken;
        t.accessTokenExpires = jwtExpiryMs(user.accessToken ?? '');
        return token;
      }
      if (Date.now() < (t.accessTokenExpires ?? 0) - 30_000) {
        return token;
      }
      try {
        const res = await fetch(`${API}/auth/refresh-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
        if (!res.ok) throw new Error('refresh failed');
        const { data } = (await res.json()) as {
          data: { accessToken: string; refreshToken: string };
        };
        t.accessToken = data.accessToken;
        t.refreshToken = data.refreshToken;
        t.accessTokenExpires = jwtExpiryMs(data.accessToken);
        delete t.error;
        return token;
      } catch {
        t.error = 'RefreshTokenError';
        return token;
      }
    },
    async session({ session, token }) {
      const t = token as AppToken;
      session.accessToken = t.accessToken;
      session.error = t.error;
      if (session.user) {
        session.user.id = t.sub ?? '';
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
