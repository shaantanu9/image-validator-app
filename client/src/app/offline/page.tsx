import type { Metadata } from 'next';
import { APP_CONFIG } from '@/constants/config';

export const metadata: Metadata = {
  title: `Offline — ${APP_CONFIG.name}`,
};

// Served by the service worker as the fallback when a navigation fails and no
// cached copy of the requested page exists.
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight text-sand-900">
        You&apos;re offline
      </h1>
      <p className="max-w-sm text-[0.9375rem] leading-relaxed text-sand-600">
        Uploading needs a connection. Reconnect and this page will pick up where you left off.
      </p>
    </div>
  );
}
