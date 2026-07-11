import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Navbar } from '@/components/common/Navbar';
import { ServiceWorkerRegistrar } from '@/components/common/ServiceWorkerRegistrar';
import { SessionProviderWrapper } from '@/components/providers/SessionProviderWrapper';
import { APP_CONFIG } from '@/constants/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: APP_CONFIG.name,
  description: APP_CONFIG.description,
};

export const viewport: Viewport = {
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (Grammarly, ColorZilla's
          cz-shortcut-listen, etc.) inject attributes on <body> before React
          hydrates, which otherwise logs a benign hydration-mismatch warning. */}
      <body className={inter.className} suppressHydrationWarning>
        <SessionProviderWrapper>
          <ServiceWorkerRegistrar />
          <Navbar />
          <main className="min-h-screen bg-gray-50">{children}</main>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
