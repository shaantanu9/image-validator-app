'use client';

import Link from 'next/link';
import { LogOut, UserRound } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { ProgressSweep } from '@/components/upload/ProgressSweep';
import { APP_CONFIG } from '@/constants/config';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/hooks/useAuth';

interface UploadTopBarProps {
  /** 0–1. How far the photo set is toward being usable. */
  progress: number;
}

/**
 * The upload flow's own header — it replaces the global navbar on this route
 * (see ROUTES_WITH_OWN_CHROME), so it has to carry the account controls the
 * navbar would otherwise provide.
 */
export const UploadTopBar = ({ progress }: UploadTopBarProps) => {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-5 sm:gap-8 sm:px-8">
        <Link href={ROUTES.HOME} className="shrink-0 rounded-xl">
          <BrandMark label={APP_CONFIG.name} className="hidden sm:inline-flex" />
          <BrandMark glyphOnly className="sm:hidden" />
        </Link>

        <div className="mx-auto w-full max-w-md">
          <ProgressSweep value={progress} label="Photo set progress" />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={ROUTES.PROFILE}
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sand-500 transition-colors hover:bg-sand-100 hover:text-sand-900"
          >
            <UserRound className="h-5 w-5" />
          </Link>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sand-500 transition-colors hover:bg-sand-100 hover:text-sand-900"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
