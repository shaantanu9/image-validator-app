import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import '@/styles/globals.css';
import { SiteHeader } from '@/components/common/SiteHeader';
import { ServiceWorkerRegistrar } from '@/components/common/ServiceWorkerRegistrar';
import { SessionProviderWrapper } from '@/components/providers/SessionProviderWrapper';
import { APP_CONFIG } from '@/constants/config';

// Poppins does the talking (headings, numerals, the loud copy); Inter does the
// quiet work (fields, filenames, captions). Exposed as CSS variables so Tailwind's
// `font-display` / `font-sans` are the only way anything picks a face.
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const display = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
};

export const viewport: Viewport = {
  themeColor: '#f26a3d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      {/* suppressHydrationWarning: browser extensions (Grammarly, ColorZilla's
          cz-shortcut-listen, etc.) inject attributes on <body> before React
          hydrates, which otherwise logs a benign hydration-mismatch warning. */}
      <body className="font-sans" suppressHydrationWarning>
        <SessionProviderWrapper>
          <ServiceWorkerRegistrar />
          <SiteHeader />
          <main className="min-h-screen bg-white">{children}</main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
