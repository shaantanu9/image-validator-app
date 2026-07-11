export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

/**
 * Routes that render their own top bar and must NOT get the global navbar.
 * The upload flow (/dashboard) has a focused header — brand, progress, exit —
 * and stacking the navbar above it would give the page two competing headers.
 */
export const ROUTES_WITH_OWN_CHROME: readonly string[] = [ROUTES.DASHBOARD];

export const ownsChrome = (pathname: string): boolean =>
  ROUTES_WITH_OWN_CHROME.some((route) => pathname === route || pathname.startsWith(`${route}/`));
