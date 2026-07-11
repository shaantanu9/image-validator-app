'use client';

import { useState } from 'react';
import { ChevronUp, Trash2, XCircle } from 'lucide-react';
import type { RejectedPhoto } from '@/hooks/useUploadQueue';
import { MIN_PHOTOS } from '@/constants/upload';

interface RejectedPanelProps {
  photos: RejectedPhoto[];
  /** How many photos DID pass — decides whether the user is blocked or merely nudged. */
  accepted: number;
  onRemove: (id: string) => void;
}

/**
 * "Some Photos Didn't Meet Our Guidelines".
 *
 * The tone here is deliberate. A rejected photo is not an error the user caused —
 * it is feedback. So:
 *
 *   - the panel is collapsible, and does NOT block the flow
 *   - if the user already has enough good photos, it says so FIRST, and calls
 *     replacing these "optional". Nobody should feel stuck behind a soft failure.
 *   - every card says WHAT was wrong (the label) and, on hover/focus, WHAT TO DO
 *     about it (the message) — both come from the server, so the wording cannot
 *     drift away from the rule that produced it
 * The server also sends an `action` ('crop' | 'replace') saying whether the photo
 * is salvageable by re-framing. We do NOT render an editor for it — the tooltip
 * copy already tells the user to move closer or crop and re-upload. A Crop button
 * with nothing behind it would be a dead affordance, which is worse than no button.
 */
export const RejectedPanel = ({ photos, accepted, onRemove }: RejectedPanelProps) => {
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<string | null>(null);

  if (photos.length === 0) return null;

  const hasEnough = accepted >= MIN_PHOTOS;

  return (
    <section className="mt-8 animate-fade-up rounded-3xl bg-danger-50/60 p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-sand-900 sm:text-2xl">
            Some photos didn&rsquo;t meet our guidelines
          </h2>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-sand-600">
            {hasEnough ? (
              <>
                You can move on — you&rsquo;ve uploaded{' '}
                <strong className="font-semibold text-sand-900">{accepted} good photos</strong>.
                Replacing these is optional.
              </>
            ) : (
              <>
                Add {MIN_PHOTOS - accepted} more {MIN_PHOTOS - accepted === 1 ? 'photo' : 'photos'}{' '}
                that meet the guidelines to continue.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse' : 'Expand'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sand-500 transition-colors hover:bg-white hover:text-sand-900"
        >
          <ChevronUp
            aria-hidden
            className={`h-5 w-5 transition-transform duration-200 ${open ? '' : 'rotate-180'}`}
          />
        </button>
      </div>

      {open && (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="flex flex-col">
              <div
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200"
                onMouseEnter={() => setActive(photo.id)}
                onMouseLeave={() => setActive(null)}
              >
                {photo.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- object URL, not a build-time asset */
                  <img
                    src={photo.previewUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-60"
                  />
                ) : (
                  // HEIC has no local preview: no browser outside Safari can decode
                  // it. Rather than render a broken image, name the file.
                  <div className="flex h-full w-full items-center justify-center px-3 text-center">
                    <span className="break-all text-xs text-sand-500">{photo.originalName}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  aria-label={`Remove ${photo.originalName}`}
                  className="hover:text-danger-600 absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-sand-700 shadow-card transition-colors hover:bg-danger-50"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>

                {/* The explanation. Shown on hover, and on keyboard focus of the
                    label below — a hover-only tooltip is unreachable by keyboard. */}
                {active === photo.id && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute inset-x-2 bottom-2 z-10 animate-fade-up rounded-2xl bg-sand-900/95 p-4 text-left shadow-lg backdrop-blur-sm"
                  >
                    <p className="flex items-center gap-2 font-display text-sm font-bold text-white">
                      <XCircle aria-hidden className="text-danger-400 h-4 w-4 shrink-0" />
                      Try again
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-sand-200">
                      {photo.message}
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onFocus={() => setActive(photo.id)}
                onBlur={() => setActive(null)}
                aria-describedby={`why-${photo.id}`}
                className="mt-3 rounded text-center text-[0.9375rem] font-medium text-sand-800 underline decoration-sand-300 decoration-dashed underline-offset-4 transition-colors hover:text-sand-900 hover:decoration-sand-500"
              >
                {photo.label}
              </button>
              <span id={`why-${photo.id}`} className="sr-only">
                {photo.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
