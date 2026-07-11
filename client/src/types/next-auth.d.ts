import type { DefaultSession } from 'next-auth';

// Augment NextAuth's User/Session/JWT with the fields we carry from the Express
// backend (the access/refresh tokens).
declare module 'next-auth' {
  interface User {
    accessToken?: string;
    refreshToken?: string;
  }

  interface Session {
    accessToken?: string;
    error?: string;
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

// NextAuth v5 (Auth.js) resolves the JWT interface from @auth/core/jwt; augment
// it too so the fields are typed inside the jwt() callback.
declare module '@auth/core/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
