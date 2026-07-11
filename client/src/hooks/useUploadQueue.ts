'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteImage, listImages, uploadImages } from '@/lib/images';
import { handleApiError } from '@/lib/api';
import {
  fileKey,
  isLocallyRenderable,
  screenFiles,
  type RejectedFile,
} from '@/lib/uploadValidation';
import { MAX_PHOTOS, MIN_PHOTOS, UPLOAD_CONCURRENCY } from '@/constants/upload';
import type { AcceptedImage, RejectionCode } from '@/types/images';

/**
 * 'rejected' is NOT 'error'.
 *
 *   error    — the upload itself failed (network, auth). Retrying may fix it.
 *   rejected — the upload SUCCEEDED and the server judged the photo against the
 *              six validation rules and declined it. Retrying the same bytes will
 *              produce the same verdict, so the UI must offer a fix, not a retry.
 *
 * Collapsing these two is how you end up with a "Retry" button that can never work.
 */
export type PhotoStatus = 'queued' | 'uploading' | 'accepted' | 'rejected' | 'error';

export interface QueuedPhoto {
  id: string;
  file: File;
  /** De-dup identity. Same value as `fileKey(file)`. */
  key: string;
  name: string;
  size: number;
  status: PhotoStatus;
  /** 0–100 while uploading. */
  progress: number;
  /** Object URL for the local thumbnail. Revoked when the photo is removed. */
  previewUrl: string;
  /**
   * False for HEIC: no browser outside Safari can paint it, so the local preview
   * would be a broken image. Verified in Chrome — both `<img src=blob:…>` and
   * `createImageBitmap()` fail with "The source image could not be decoded".
   * The UI shows a placeholder until the server returns the transcoded URL.
   */
  canPreview: boolean;
  /** Set once the server has ACCEPTED and stored it. */
  accepted?: AcceptedImage;
  /** Set when the server REJECTED it. Carries the copy the UI renders. */
  rejection?: {
    /** The server row id — needed to delete it. */
    imageId: string;
    reason: RejectionCode;
    label: string;
    message: string;
    action: 'crop' | 'replace';
  };
  /** Set when the upload FAILED (transport). Safe to show to the user. */
  error?: string;
}

/** What RejectedPanel renders. Flattened so the component needs no null-checks. */
export interface RejectedPhoto {
  id: string;
  originalName: string;
  /** Null for a HEIC — the browser cannot decode it for a local preview. */
  previewUrl: string | null;
  reason: RejectionCode;
  label: string;
  message: string;
  action: 'crop' | 'replace';
}

let counter = 0;
const nextId = () => `photo-${++counter}`;

/**
 * Owns the photo set: hydration, screening, upload, verdicts, removal.
 *
 * One HTTP request per photo, sent SEQUENTIALLY (UPLOAD_CONCURRENCY = 1). The
 * server guarantees exactly one of N identical photos is accepted regardless — its
 * per-owner lock sees to that — but WHICH one wins depends on arrival order. Firing
 * requests concurrently made that a race, and a user could watch their original get
 * rejected as a duplicate of its own downscaled copy. Sequential upload makes the
 * first photo the user picked the one that wins.
 */
export const useUploadQueue = () => {
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Abort controllers, so removing a photo cancels its in-flight request instead
  // of letting it land on a photo that no longer exists.
  const controllers = useRef(new Map<string, AbortController>());
  // Photos this hook has already started. Guards against the pump double-firing
  // for the same photo across two renders.
  const started = useRef(new Set<string>());

  const patch = useCallback((id: string, changes: Partial<QueuedPhoto>) => {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...changes } : photo)),
    );
  }, []);

  const runUpload = useCallback(
    async (photo: QueuedPhoto) => {
      const controller = new AbortController();
      controllers.current.set(photo.id, controller);
      patch(photo.id, { status: 'uploading', progress: 0, error: undefined });

      try {
        const result = await uploadImages([photo.file], (progress) =>
          patch(photo.id, { progress }),
        );

        // One file in, so exactly one verdict out.
        const accepted = result.accepted[0];
        const rejected = result.rejected[0];

        if (accepted) {
          patch(photo.id, { status: 'accepted', progress: 100, accepted });
        } else if (rejected) {
          // A 200 that says "no". The photo is fine as a file and wrong as a photo.
          patch(photo.id, {
            status: 'rejected',
            progress: 100,
            rejection: {
              imageId: rejected.id,
              reason: rejected.reason,
              label: rejected.label,
              message: rejected.message,
              action: rejected.action,
            },
          });
        } else {
          patch(photo.id, { status: 'error', error: 'The server returned no verdict.' });
        }
      } catch (error) {
        // A removed photo aborts its own request; that isn't a failure to report.
        if (controller.signal.aborted) return;
        patch(photo.id, { status: 'error', error: handleApiError(error) });
      } finally {
        controllers.current.delete(photo.id);
      }
    },
    [patch],
  );

  // The pump. Whenever the set changes, top up the in-flight uploads to the
  // concurrency limit with whatever is still queued.
  useEffect(() => {
    const inFlight = photos.filter((photo) => photo.status === 'uploading').length;
    const free = UPLOAD_CONCURRENCY - inFlight;
    if (free <= 0) return;

    photos
      .filter((photo) => photo.status === 'queued' && !started.current.has(photo.id))
      .slice(0, free)
      .forEach((photo) => {
        started.current.add(photo.id);
        void runUpload(photo);
      });
  }, [photos, runUpload]);

  /** Cancel everything still in flight when the page unmounts. */
  useEffect(() => {
    const active = controllers.current;
    return () => {
      active.forEach((controller) => controller.abort());
    };
  }, []);

  /**
   * Hydrate from the server on mount.
   *
   * Without this the page shows "0 of 10" after a reload while the account still
   * holds every photo previously stored — and the duplicate rule then fires against
   * images the user cannot see. Observed: uploading a photo of a DIFFERENT PERSON
   * came back "Too similar to another upload", because the real match was an
   * invisible row from an earlier session. An unexplainable rejection is the worst
   * failure this UI can produce, and it was caused purely by not loading state.
   *
   * A server-stored photo has no local `File`, so `file` is a stub: it is never
   * re-uploaded, only displayed and (optionally) deleted.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await listImages();
        if (cancelled) return;

        const hydrated = stored.map((row): QueuedPhoto => {
          const base = {
            id: nextId(),
            file: new File([], row.originalName),
            key: `server:${row.id}`,
            name: row.originalName,
            size: 0,
            progress: 100,
            previewUrl: '',
          };

          if (row.status === 'ACCEPTED') {
            return {
              ...base,
              size: row.bytes ?? 0,
              status: 'accepted',
              // The server URL is the ONLY thing that can paint a stored HEIC —
              // it points at the transcoded JPEG.
              previewUrl: row.url ?? '',
              canPreview: Boolean(row.url),
              accepted: row,
            };
          }

          return {
            ...base,
            status: 'rejected',
            // A rejected photo was never stored, so there is nothing to show. The
            // card falls back to the filename.
            canPreview: false,
            rejection: {
              imageId: row.id,
              reason: row.reason,
              label: row.label,
              message: row.message,
              action: row.action,
            },
          };
        });

        // MERGE, never replace. GET /images is in flight for as long as it takes,
        // and a user can drop photos into the dropzone before it answers. Assigning
        // the server's list wholesale then erased those photos — silently, and
        // mid-upload, so a queued one never even got sent. Stored photos go first
        // (they are older); anything the user has already picked survives.
        setPhotos((current) => [...hydrated, ...current]);
      } catch {
        // A failed hydrate must not break the page — the user can still upload.
        // They just start from an empty list.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;

    setPhotos((current) => {
      // Dedup against EVERY photo, including rejected ones — re-adding the exact
      // same file that was just refused would only earn the same refusal.
      const existingKeys = new Set(current.map((photo) => photo.key));

      // ...but slots are only held by photos that count (see `occupied`). A rejected
      // photo must not block the replacement the UI is inviting the user to make.
      const held = current.filter(
        (photo) => photo.status !== 'rejected' && photo.status !== 'error',
      ).length;
      const remaining = MAX_PHOTOS - held;

      const { accepted, rejected } = screenFiles(incoming, existingKeys, remaining);

      setRejections(rejected);

      if (accepted.length === 0) return current;

      const added: QueuedPhoto[] = accepted.map((file) => ({
        id: nextId(),
        file,
        key: fileKey(file),
        name: file.name,
        size: file.size,
        status: 'queued',
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        canPreview: isLocallyRenderable(file),
      }));

      return [...current, ...added];
    });
  }, []);

  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    started.current.delete(id);

    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (!target) return current;

      // Object URLs are held by the document until revoked — leaking them leaks the
      // whole decoded image. Hydrated rows carry a REMOTE url (or none), which must
      // not be passed to revokeObjectURL.
      if (target.previewUrl.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);

      // The server has a row for anything it judged (accepted OR rejected). Drop it
      // too, so "remove" means removed — not just hidden. Fire-and-forget: a failed
      // delete must not block the UI, and the row is owner-scoped and harmless.
      const serverId = target.accepted?.id ?? target.rejection?.imageId;
      if (serverId) void deleteImage(serverId).catch(() => undefined);

      return current.filter((photo) => photo.id !== id);
    });
  }, []);

  /**
   * Retry is for a FAILED upload, never a REJECTED one. Re-sending the same bytes
   * to the same rules produces the same verdict — a retry button there would be a
   * dead affordance.
   */
  const retry = useCallback((id: string) => {
    started.current.delete(id);
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id && photo.status === 'error'
          ? { ...photo, status: 'queued', progress: 0, error: undefined }
          : photo,
      ),
    );
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  const uploaded = photos.filter((photo) => photo.status === 'accepted').length;
  const failed = photos.filter((photo) => photo.status === 'error').length;
  const isUploading = photos.some(
    (photo) => photo.status === 'uploading' || photo.status === 'queued',
  );

  /**
   * How many of the MAX_PHOTOS slots are actually TAKEN.
   *
   * A REJECTED photo does not hold a slot. It failed validation, it will never be
   * part of the set, and the entire point of showing it is so the user can replace
   * it — so counting it toward the limit locks them out of doing the one thing the
   * UI is asking them to do. (Bug: 9 accepted + 1 rejected read as "10 of 10, full"
   * and the dropzone refused new files.)
   *
   * A FAILED upload (transport error) also holds no slot: nothing was stored.
   * Queued and in-flight photos DO hold one — they are on their way to being real.
   */
  const occupied = photos.filter(
    (photo) => photo.status !== 'rejected' && photo.status !== 'error',
  ).length;

  const rejectedPhotos: RejectedPhoto[] = photos
    .filter((photo) => photo.status === 'rejected' && photo.rejection)
    .map((photo) => ({
      id: photo.id,
      originalName: photo.name,
      previewUrl: photo.canPreview ? photo.previewUrl : null,
      reason: photo.rejection!.reason,
      label: photo.rejection!.label,
      message: photo.rejection!.message,
      action: photo.rejection!.action,
    }));

  return {
    photos,
    /** Files refused BEFORE upload, by the client-side screen (type/size/count). */
    rejections,
    /** Photos the SERVER judged against the six rules and declined. */
    rejectedPhotos,
    addFiles,
    remove,
    retry,
    dismissRejections,
    uploaded,
    failed,
    isUploading,
    /** True while the previously-stored photos are being fetched. */
    isLoading,
    /** Photos actually holding a slot — see `occupiedSlots`. */
    occupied,
    isFull: occupied >= MAX_PHOTOS,
    remainingSlots: Math.max(0, MAX_PHOTOS - occupied),
    /** The set is usable once this many photos are safely stored. */
    meetsMinimum: uploaded >= MIN_PHOTOS,
  };
};
