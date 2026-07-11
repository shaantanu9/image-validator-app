'use client';

import { useSession, signOut } from 'next-auth/react';
import type { User } from '@/types/auth';

// Thin wrapper over NextAuth's useSession that preserves the previous useAuth()
// shape, so components keep reading `user` / `isAuthenticated` / `logout`.
export const useAuth = () => {
  const { data: session, status } = useSession();

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        userId: session.user.id,
        email: session.user.email ?? '',
        name: session.user.name ?? null,
      }
    : null;

  return {
    user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    // NextAuth resolves the session on the client; treat "not loading" as hydrated.
    hasHydrated: status !== 'loading',
    error: null as string | null,
    logout: () => signOut({ redirectTo: '/login' }),
    clearError: () => {},
  };
};
