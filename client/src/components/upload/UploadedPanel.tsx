'use client';

import { Ban, CircleCheck, ImageIcon, PartyPopper, Trash2 } from 'lucide-react';
import { Disclosure } from '@/components/upload/Disclosure';
import { ProgressSweep } from '@/components/upload/ProgressSweep';
import { MAX_PHOTOS, MIN_PHOTOS, PHOTO_REQUIREMENTS, PHOTO_RESTRICTIONS } from '@/constants/upload';
import { RejectedPanel } from '@/components/upload/RejectedPanel';
import type { QueuedPhoto, RejectedPhoto } from '@/hooks/useUploadQueue';

interface UploadedPanelProps {
  photos: QueuedPhoto[];
  uploaded: number;
  /** Photos the SERVER declined against the six validation rules. */
  rejectedPhotos: RejectedPhoto[];
  onRemove: (id: string) => void;
}

export const UploadedPanel = ({
  photos,
  uploaded,
  rejectedPhotos,
  onRemove,
}: UploadedPanelProps) => {
  const stored = photos.filter((photo) => photo.status === 'accepted');
  const shortBy = Math.max(0, MIN_PHOTOS - uploaded);

  return (
    <div className="flex h-full flex-col gap-8">
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-sand-900">
            Uploaded photos
          </h2>
          <p className="font-display text-lg tabular-nums text-sand-400">
            <span className="font-bold text-sand-900">{uploaded}</span> of {MAX_PHOTOS}
          </p>
        </div>
        <ProgressSweep
          value={uploaded / MAX_PHOTOS}
          weight="hair"
          label="Photos uploaded"
          className="mt-3"
        />
      </div>

      <div className="space-y-4">
        <Disclosure
          title="Photo requirements"
          tone="success"
          items={PHOTO_REQUIREMENTS}
          icon={<CircleCheck aria-hidden className="h-6 w-6 shrink-0 text-success-500" />}
        />
        <Disclosure
          title="Photo restrictions"
          tone="danger"
          items={PHOTO_RESTRICTIONS}
          icon={<Ban aria-hidden className="h-6 w-6 shrink-0 text-danger-500" />}
        />
      </div>

      {stored.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-sand-200 px-6 py-16 text-center">
          <ImageIcon aria-hidden className="h-8 w-8 text-sand-300" />
          <p className="mt-4 font-display text-base font-semibold text-sand-800">
            Your photos will appear here
          </p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-sand-500">
            Pick at least {MIN_PHOTOS} to get started. Read the requirements above first — it saves
            a round of re-shooting.
          </p>
        </div>
      ) : (
        <div className="flex-1">
          {uploaded >= MIN_PHOTOS ? (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
              <PartyPopper aria-hidden className="h-5 w-5 shrink-0 text-success-700" />
              <p className="text-[0.9375rem] text-sand-800">
                <span className="font-display font-semibold text-sand-900">Your set is ready.</span>{' '}
                {uploaded} photos are stored and meet the requirements. Add up to{' '}
                {MAX_PHOTOS - uploaded} more for a better result.
              </p>
            </div>
          ) : (
            <p className="mb-5 text-[0.9375rem] text-sand-600">
              {shortBy} more {shortBy === 1 ? 'photo' : 'photos'} to reach the {MIN_PHOTOS}-photo
              minimum.
            </p>
          )}

          <ul className="grid grid-cols-3 gap-3 rounded-3xl bg-success-50/50 p-3 sm:grid-cols-4 lg:grid-cols-5">
            {stored.map((photo) => (
              <li
                key={photo.id}
                className="group relative aspect-square animate-fade-up overflow-hidden rounded-2xl bg-sand-100 ring-1 ring-sand-200"
              >
                {/* Every photo in this grid was ACCEPTED, so the server has stored
                    it — and the server's URL is the only one that can paint a HEIC,
                    because it points at the transcoded JPEG. The local object URL is
                    a fallback for when the CDN is not configured. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- remote ImageKit URL, not a build-time asset */}
                <img
                  src={photo.accepted?.url ?? photo.previewUrl}
                  alt={photo.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* An accepted photo must be removable too — otherwise a full set is
                    a dead end, and the user can never swap a merely-OK photo for a
                    better one. `onRemove` deletes the server row as well, so this
                    frees a real slot rather than just hiding a thumbnail.
                    Always rendered (not hover-only) so it works on touch. */}
                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  aria-label={`Remove ${photo.name}`}
                  className="hover:text-danger-600 absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sand-700 opacity-0 shadow-card backdrop-blur-sm transition-all hover:bg-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sits OUTSIDE the branch above on purpose: if every photo was rejected,
          `stored` is empty and the user still has to be told why. Rendering this
          only alongside the accepted grid would leave them with an empty screen and
          no explanation — the single worst outcome for this flow. */}
      <RejectedPanel photos={rejectedPhotos} accepted={uploaded} onRemove={onRemove} />
    </div>
  );
};
