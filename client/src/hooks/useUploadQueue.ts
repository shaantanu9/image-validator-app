'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadImage, type ImageKitUploadResult } from '@/lib/imagekit';
import { handleApiError } from '@/lib/api';
import { fileKey, screenFiles, type RejectedFile } from '@/lib/uploadValidation';
import { MAX_PHOTOS, MIN_PHOTOS, UPLOAD_CONCURRENCY } from '@/constants/upload';

export type PhotoStatus = 'queued' | 'uploading' | 'done' | 'error';

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
  /** Set once the server has stored it. */
  result?: ImageKitUploadResult;
  /** Set when the upload failed. Safe to show to the user. */
  error?: string;
}

let counter = 0;
const nextId = () => `photo-${++counter}`;

/**
 * Owns the photo set: screening, upload, retry, removal.
 *
 * Uploads run at UPLOAD_CONCURRENCY, one HTTP request per photo (the backend
 * takes exactly one file per request). The pump is driven off state changes
 * rather than a loop, so removing or retrying a photo mid-flight re-enters it
 * naturally.
 */
export const useUploadQueue = () => {
  const [photos, setPhotos] = useState<QueuedPhoto[]>([]);
  const [rejections, setRejections] = useState<RejectedFile[]>([]);

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
        const result = await uploadImage(photo.file, {
          signal: controller.signal,
          onProgress: (progress) => patch(photo.id, { progress }),
        });
        patch(photo.id, { status: 'done', progress: 100, result });
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

  const addFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return;

    setPhotos((current) => {
      const existingKeys = new Set(current.map((photo) => photo.key));
      const remaining = MAX_PHOTOS - current.length;
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
      // Object URLs are held by the document until revoked — leaking them leaks
      // the whole image.
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }, []);

  const retry = useCallback((id: string) => {
    // Drop it from `started` so the pump picks it up as if it were new.
    started.current.delete(id);
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, status: 'queued', progress: 0, error: undefined } : photo,
      ),
    );
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  const uploaded = photos.filter((photo) => photo.status === 'done').length;
  const failed = photos.filter((photo) => photo.status === 'error').length;
  const isUploading = photos.some(
    (photo) => photo.status === 'uploading' || photo.status === 'queued',
  );

  return {
    photos,
    rejections,
    addFiles,
    remove,
    retry,
    dismissRejections,
    uploaded,
    failed,
    isUploading,
    isFull: photos.length >= MAX_PHOTOS,
    remainingSlots: Math.max(0, MAX_PHOTOS - photos.length),
    /** The set is usable once this many photos are safely stored. */
    meetsMinimum: uploaded >= MIN_PHOTOS,
  };
};
