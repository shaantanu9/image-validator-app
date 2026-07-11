'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/Button';
import { BrandMark } from '@/components/ui/BrandMark';
import { APP_CONFIG } from '@/constants/config';

export const Navbar = () => {
  const { user, isAuthenticated, hasHydrated, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-30 border-b border-sand-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Link href={ROUTES.HOME} className="rounded-xl">
          <BrandMark label={APP_CONFIG.name} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Render nothing auth-dependent until the session resolves, so the
              server-rendered logged-out state doesn't flash before the client
              knows the user is signed in. */}
          {!hasHydrated ? null : isAuthenticated ? (
            <>
              <Link href={ROUTES.DASHBOARD} className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <span data-testid="user-email" className="hidden text-sm text-sand-600 md:inline">
                {user?.email}
              </span>
              <Button data-testid="logout-button" variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href={ROUTES.LOGIN}>
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href={ROUTES.REGISTER}>
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
