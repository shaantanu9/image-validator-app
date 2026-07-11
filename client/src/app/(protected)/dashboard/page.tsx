'use client';

import Link from 'next/link';
import { ArrowLeft, ScanFace, X } from 'lucide-react';
import { Dropzone } from '@/components/upload/Dropzone';
import { PhotoRow } from '@/components/upload/PhotoRow';
import { UploadTopBar } from '@/components/upload/UploadTopBar';
import { UploadedPanel } from '@/components/upload/UploadedPanel';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { MAX_PHOTOS, MIN_PHOTOS } from '@/constants/upload';
import { ROUTES } from '@/constants/routes';

/**
 * The upload flow IS the dashboard — signing in drops you straight into the job
 * the product exists to do. It renders its own top bar (see ROUTES_WITH_OWN_CHROME),
 * so the global navbar stands down here.
 */
export default function DashboardPage() {
  const {
    photos,
    rejections,
    addFiles,
    remove,
    retry,
    dismissRejections,
    uploaded,
    isUploading,
    isFull,
    remainingSlots,
  } = useUploadQueue();

  // The top bar tracks the minimum, not the maximum: the bar filling means "you
  // can proceed", which is the only threshold the user cares about.
  const progress = Math.min(1, uploaded / MIN_PHOTOS);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <UploadTopBar progress={progress} />

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-y-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(340px,400px)_1fr] lg:gap-x-14 lg:py-10">
        <aside className="flex min-w-0 flex-col">
          <Link href={ROUTES.HOME} className="w-fit rounded-xl">
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-sand-300 bg-white px-4 font-display text-sm font-semibold text-sand-800 shadow-card transition-colors hover:bg-sand-50">
              <ArrowLeft aria-hidden className="h-4 w-4" />
              Back
            </span>
          </Link>

          <div className="mt-9">
            <span className="brand-sweep inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-glow">
              <ScanFace aria-hidden className="h-6 w-6 text-white" />
            </span>

            <h1 className="mt-5 font-display text-[2.5rem] font-bold leading-[1.1] tracking-tight text-sand-900">
              Upload photos
            </h1>

            <p className="mt-4 text-[0.9375rem] leading-relaxed text-sand-600">
              Pick at least{' '}
              <strong className="font-semibold text-sand-900">
                {MIN_PHOTOS} of your best photos
              </strong>
              . A mix of{' '}
              <strong className="font-semibold text-sand-900">
                close-ups, selfies and mid-range shots
              </strong>{' '}
              gives us the most to work with — we check each one for face, sharpness and lighting
              before it’s stored.
            </p>
          </div>

          <div className="mt-7">
            <Dropzone
              onFiles={addFiles}
              isFull={isFull}
              isUploading={isUploading}
              remainingSlots={remainingSlots}
            />
          </div>

          {rejections.length > 0 && (
            <div
              role="alert"
              className="mt-4 animate-fade-up rounded-2xl border border-danger-200 bg-danger-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-sm font-semibold text-sand-900">
                  {rejections.length} {rejections.length === 1 ? 'photo was' : 'photos were'} not
                  added
                </p>
                <button
                  type="button"
                  onClick={dismissRejections}
                  aria-label="Dismiss"
                  className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-sand-500 transition-colors hover:bg-white hover:text-sand-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {rejections.map((rejection) => (
                  <li key={rejection.file.name} className="text-xs leading-relaxed text-sand-700">
                    <span className="font-medium text-sand-900">{rejection.file.name}</span> —{' '}
                    {rejection.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {photos.length > 0 && (
            <>
              <p className="mt-6 text-sm text-sand-500">
                {isUploading
                  ? 'Uploading — this can take up to a minute.'
                  : `${photos.length} of ${MAX_PHOTOS} photos added.`}
              </p>
              <ul className="mt-3 space-y-2">
                {photos.map((photo) => (
                  <PhotoRow key={photo.id} photo={photo} onRemove={remove} onRetry={retry} />
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="min-w-0 border-t border-sand-200 pt-10 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
          <UploadedPanel photos={photos} uploaded={uploaded} />
        </section>
      </div>
    </div>
  );
}
