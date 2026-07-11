import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from '@/auth.config';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5012/api/v1';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // Delegate to the Express backend — it owns the users, password hashing,
      // and token issuance. On success we return the user + the Express
      // access/refresh tokens, which the jwt callback stores in the session.
      authorize: async (credentials) => {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });
        if (!res.ok) return null;
        const { data } = (await res.json()) as {
          data: {
            user: { id: string; email: string; name: string | null };
            tokens: { accessToken: string; refreshToken: string };
          };
        };
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
        };
      },
    }),
  ],
});
