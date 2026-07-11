'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/common/Navbar';
import { ownsChrome } from '@/constants/routes';

/**
 * Renders the global navbar everywhere except on routes that supply their own
 * header (see ROUTES_WITH_OWN_CHROME). Lives in the root layout so the navbar
 * mounts once, instead of every page having to remember to include it.
 */
export const SiteHeader = () => {
  const pathname = usePathname();
  return ownsChrome(pathname ?? '/') ? null : <Navbar />;
};
