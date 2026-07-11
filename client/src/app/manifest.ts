import type { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/constants/config';

// Next.js serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> tag — no manual wiring in <head> needed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.name,
    short_name: APP_CONFIG.name,
    description: APP_CONFIG.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#111827',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
