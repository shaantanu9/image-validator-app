'use client';

import Link from 'next/link';
import { ArrowRight, Ban, Focus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/constants/routes';
import { ACCEPTED_LABEL, MIN_PHOTOS } from '@/constants/upload';

// What the checker actually looks at. Named for what the user recognises in
// their own photos, not for the server-side check that implements it.
const CHECKS = [
  {
    icon: Focus,
    title: 'One face, in focus',
    body: 'We look for a single, sharp face. Group shots and blurry frames don’t make it through.',
  },
  {
    icon: Ban,
    title: 'No duplicates',
    body: 'The same photo picked twice is caught before it’s uploaded, so your set stays varied.',
  },
  {
    icon: ShieldCheck,
    title: 'Checked on the server',
    body: 'Every file is read byte-by-byte before it’s stored — a renamed .exe is still an .exe.',
  },
];

export default function HomePage() {
  const { isAuthenticated, hasHydrated } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-20 sm:px-8">
      <section className="text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-primary-600">
          Photo set validator
        </p>

        <h1 className="mx-auto mt-5 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-sand-900 sm:text-6xl">
          Upload photos that <span className="brand-sweep-text">actually work</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sand-600">
          Pick {MIN_PHOTOS} or more. We check each one for a face, sharpness and size before it’s
          stored — so you find out now, not after everything’s been processed.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* Nothing auth-dependent renders until the session resolves, so a signed-in
              visitor never sees "Sign in" flash before the real CTA. */}
          {!hasHydrated ? (
            <div className="h-12" />
          ) : isAuthenticated ? (
            <Link href={ROUTES.DASHBOARD}>
              <Button size="lg">
                Upload photos
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href={ROUTES.REGISTER}>
                <Button size="lg">
                  Get started
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={ROUTES.LOGIN}>
                <Button variant="outline" size="lg">
                  Sign in
                </Button>
              </Link>
            </>
          )}
        </div>

        <p className="mt-5 text-sm text-sand-500">{ACCEPTED_LABEL}</p>
      </section>

      <section className="mt-24 grid gap-4 sm:grid-cols-3">
        {CHECKS.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-3xl border border-sand-200 bg-sand-50 p-7 transition-colors hover:border-sand-300 hover:bg-white"
          >
            <Icon aria-hidden className="h-6 w-6 text-primary-500" />
            <h2 className="mt-5 font-display text-lg font-bold tracking-tight text-sand-900">
              {title}
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-sand-600">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
