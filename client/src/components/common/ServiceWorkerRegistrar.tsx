'use client';

import { useEffect } from 'react';

// Registers the PWA service worker after the page loads. Registration is limited
// to production builds — in dev, Next's HMR and the SW's caching fight each other.
// Renders nothing; mount it once in the root layout.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-fatal: the app works fine without offline support.
      });
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
