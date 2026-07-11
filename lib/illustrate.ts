"use client";

/**
 * On-demand scene illustration for a card. Sends only a sanitized scene prompt
 * to /api/image, then crops + downscales whatever Gemini returns to a snug card
 * banner and JPEG-compresses it — flat illustration art lands around 30–60 KB,
 * so it stores comfortably inline on the entry.
 */

import { getPreferredModel } from "./models";
import { getPreferredStyle } from "./styles";

// The card banner shape (2× the on-screen header for crispness on retina).
const BANNER_W = 960;
const BANNER_H = 430;
const QUALITY = 0.82;

/** An error carrying the route's actionable hint, so the card can show the fix. */
export class IllustrateError extends Error {
  hint?: string;
  code?: string;
  constructor(message: string, hint?: string, code?: string) {
    super(message);
    this.name = "IllustrateError";
    this.hint = hint;
    this.code = code;
  }
}

export async function generateIllustration(prompt: string): Promise<string> {
  const [pref, style] = await Promise.all([getPreferredModel(), getPreferredStyle()]);
  const model = pref || undefined; // empty ⇒ let the server auto-pick
  let res: Response;
  try {
    res = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, style }),
    });
  } catch {
    throw new IllustrateError("Couldn't reach the illustration service.", "Check your connection and try again.");
  }

  let data: { image?: string; error?: string; hint?: string; code?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !data.image) {
    throw new IllustrateError(
      data.error || `Couldn't generate the illustration (${res.status}).`,
      data.hint,
      data.code,
    );
  }
  return fitToBanner(data.image);
}

/** Center-crop the source to the banner aspect and downscale to BANNER_W×BANNER_H. */
function fitToBanner(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetRatio = BANNER_W / BANNER_H;
      const srcRatio = img.width / img.height;
      let sw = img.width;
      let sh = img.height;
      let sx = 0;
      let sy = 0;
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = BANNER_W;
      canvas.height = BANNER_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new IllustrateError("Couldn't process the illustration."));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, BANNER_W, BANNER_H);
      resolve(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => reject(new IllustrateError("The generated image couldn't be read."));
    img.src = src;
  });
}
