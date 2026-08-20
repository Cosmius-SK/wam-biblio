"use client";

import type { EntryPhoto, Portrait } from "./types";
import { getSetting, setSetting } from "./db";
import { decryptBytes, encryptBytes, generateMediaKey, importMediaKey } from "./crypto";
import {
  DRIVE_FORBIDDEN,
  RECONNECT,
  deleteDriveFile,
  downloadEncrypted,
  ensureFolder,
  getAccessToken,
  uploadEncrypted,
} from "./drive";

/**
 * The photo pipeline: compress on-device → encrypt with the journal's media
 * key → upload to the user's own Drive folder. Only ciphertext ever leaves
 * the device; a tiny local thumbnail keeps the timeline fast and offline.
 */
export interface PendingPhoto {
  id: string;
  blob: Blob;
  thumb: string;
  width: number;
  height: number;
}

const FULL_DIM = 1600;
const FULL_QUALITY = 0.85;
// The thumbnail is what the timeline actually shows — including the full-width
// hero — so it needs enough resolution to stay crisp on high-DPI phones.
const THUMB_DIM = 900;
const THUMB_QUALITY = 0.82;

const FRIENDLY_RECONNECT =
  "Google Drive needs (re)connecting — open Backup & restore and tap Connect.";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image."));
    };
    img.src = url;
  });
}

function scaled(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process the image.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't compress the image."))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Downscale + compress a picked file; returns the upload blob and a local thumb. */
export async function prepareImage(file: File): Promise<PendingPhoto> {
  const img = await loadImage(file);
  try {
    const full = scaled(img, FULL_DIM);
    const blob = await toJpegBlob(full, FULL_QUALITY);
    const thumb = scaled(img, THUMB_DIM).toDataURL("image/jpeg", THUMB_QUALITY);
    return { id: crypto.randomUUID(), blob, thumb, width: full.width, height: full.height };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/**
 * A Drive token for an upload the user just initiated: try a silent refresh
 * first, and if that fails (an expired token, no Google session in a PWA) fall
 * back to the interactive consent popup while their tap is still fresh.
 */
async function driveUploadToken(): Promise<string> {
  try {
    return await getAccessToken(false);
  } catch {
    try {
      return await getAccessToken(true);
    } catch {
      throw new Error(FRIENDLY_RECONNECT);
    }
  }
}

/** The journal's media key — created once, then carried inside encrypted backups/sync. */
async function mediaCryptoKey(): Promise<CryptoKey> {
  let b64 = await getSetting("mediaKey");
  if (!b64) {
    b64 = generateMediaKey();
    await setSetting("mediaKey", b64);
  }
  return importMediaKey(b64);
}

/** Encrypt + upload pending photos; returns the metadata to store on the entry. */
export async function uploadPhotos(
  pending: PendingPhoto[],
  onProgress?: (done: number, total: number) => void,
): Promise<EntryPhoto[]> {
  const token = await driveUploadToken();
  const folderId = await ensureFolder(token);
  const key = await mediaCryptoKey();
  const photos: EntryPhoto[] = [];
  for (let i = 0; i < pending.length; i++) {
    onProgress?.(i, pending.length);
    const p = pending[i];
    const packed = await encryptBytes(key, await p.blob.arrayBuffer());
    const driveFileId = await uploadEncrypted(token, folderId, `photo-${p.id}.enc`, packed);
    photos.push({ id: p.id, driveFileId, thumb: p.thumb, width: p.width, height: p.height });
  }
  onProgress?.(pending.length, pending.length);
  return photos;
}

/**
 * Remove photos nothing will ever reference again — an abandoned draft's
 * attachments. Best effort by design: failing to tidy Drive must never stop
 * someone from starting fresh, and an orphaned encrypted blob is inert.
 */
export async function deletePhotos(photos: EntryPhoto[]): Promise<void> {
  if (photos.length === 0) return;
  try {
    const token = await driveUploadToken();
    for (const p of photos) {
      try {
        await deleteDriveFile(token, p.driveFileId);
      } catch {
        /* already gone, or offline — it will simply sit there */
      }
    }
  } catch {
    /* no token right now; the blobs stay, harmlessly */
  }
}

/** Encrypt + upload one self-portrait; returns the metadata to store locally.
 * The thumbnail lives on-device (fast, offline timelapse); only the encrypted
 * full-size original leaves for the writer's own Drive. */
export async function uploadPortrait(pending: PendingPhoto, capturedAt: number): Promise<Portrait> {
  const token = await driveUploadToken();
  const folderId = await ensureFolder(token);
  const key = await mediaCryptoKey();
  const packed = await encryptBytes(key, await pending.blob.arrayBuffer());
  const driveFileId = await uploadEncrypted(token, folderId, `portrait-${pending.id}.enc`, packed);
  return {
    id: pending.id,
    driveFileId,
    thumb: pending.thumb,
    width: pending.width,
    height: pending.height,
    capturedAt,
  };
}

/** Download + decrypt a photo; returns an object URL (caller revokes it). */
export async function loadPhotoUrl(photo: EntryPhoto): Promise<string> {
  let token: string;
  try {
    token = await getAccessToken(false);
  } catch (err) {
    throw new Error(err instanceof Error && err.message !== RECONNECT ? err.message : FRIENDLY_RECONNECT);
  }
  const packed = await downloadEncrypted(token, photo.driveFileId);
  const key = await mediaCryptoKey();
  try {
    const buf = await decryptBytes(key, packed);
    return URL.createObjectURL(new Blob([buf], { type: "image/jpeg" }));
  } catch {
    throw new Error(
      "Couldn't unlock this photo on this device — Pull & merge your sync here first (it carries the photo key).",
    );
  }
}
