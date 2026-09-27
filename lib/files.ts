"use client";

import type { Attachment, AttachmentKind } from "./types";

const TEXT_EXT =
  /\.(txt|csv|tsv|md|markdown|json|js|ts|tsx|jsx|py|java|c|cpp|cs|go|rb|php|html|css|xml|yml|yaml|sql|log|ini|env|sh)$/i;

// Vercel caps function request bodies at 4.5 MB. Data URLs add ~33%, so we
// keep the raw attachment total under ~3 MB to stay safely inside the limit.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB per image (pre-compression guard)
const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3MB per PDF
const MAX_TEXT_BYTES = 1 * 1024 * 1024; // 1MB per text file
/** Target size for a compressed image so several can fit per message. */
const IMAGE_TARGET_BYTES = 1_100_000;
/** Max combined raw size of all attachments in one message. */
export const MAX_TOTAL_BYTES = 3 * 1024 * 1024; // ~3MB total

export function totalAttachmentBytes(list: Attachment[]): number {
  return list.reduce((sum, a) => sum + (a.size || 0), 0);
}

export function classify(file: File): AttachmentKind | "unsupported" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) return "text";
  return "unsupported";
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ----------------------------- image resizing ---------------------------- */

type Drawable = ImageBitmap | HTMLImageElement;

function drawableSize(d: Drawable): { w: number; h: number } {
  const w = "naturalWidth" in d ? d.naturalWidth : d.width;
  const h = "naturalHeight" in d ? d.naturalHeight : d.height;
  return { w, h };
}

function closeDrawable(d: Drawable) {
  if ("close" in d && typeof d.close === "function") d.close();
}

async function loadDrawable(file: File): Promise<Drawable | null> {
  // Preferred: createImageBitmap (fast, off-thread).
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to Image element */
    }
  }
  // Fallback: HTMLImageElement from an object URL.
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function bytesOfDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const b64 = dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4);
}

function renderToJpeg(
  d: Drawable,
  maxDim: number,
  quality: number,
): { dataUrl: string; bytes: number } | null {
  const { w, h } = drawableSize(d);
  if (!w || !h) return null;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // White background so transparent PNGs don't turn black in JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(d as CanvasImageSource, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, bytes: bytesOfDataUrl(dataUrl) };
}

/**
 * Resize + re-encode an image so phone photos (often 4–12 MB) fit under the
 * request-body limit. Returns null when compression isn't possible, in which
 * case the caller falls back to the original when small enough.
 */
export async function compressImage(
  file: File,
): Promise<{ dataUrl: string; bytes: number } | null> {
  if (typeof document === "undefined") return null;
  if (file.type === "image/gif") return null; // don't flatten animations
  try {
    const d = await loadDrawable(file);
    if (!d) return null;
    let maxDim = 1600;
    let quality = 0.85;
    let best: { dataUrl: string; bytes: number } | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const out = renderToJpeg(d, maxDim, quality);
      if (out) best = out;
      if (out && out.bytes <= IMAGE_TARGET_BYTES) break;
      if (quality > 0.62) quality = Math.max(0.6, quality - 0.12);
      else maxDim = Math.round(maxDim * 0.8);
    }
    closeDrawable(d);
    return best;
  } catch {
    return null;
  }
}

/* ----------------------------- attachments ------------------------------- */

export interface FileResult {
  attachment?: Attachment;
  error?: string;
  /** true when the image was resized/re-encoded */
  compressed?: boolean;
}

export async function fileToAttachment(file: File): Promise<FileResult> {
  const kind = classify(file);

  if (kind === "unsupported") {
    if (file.size <= MAX_TEXT_BYTES) {
      try {
        const text = await readAsText(file);
        return {
          attachment: {
            id: crypto.randomUUID(),
            name: file.name,
            mime: file.type || "text/plain",
            size: file.size,
            kind: "text",
            text,
          },
        };
      } catch {
        /* fallthrough */
      }
    }
    return { error: `${file.name}: unsupported file type` };
  }

  if (kind === "image") {
    const compressed = await compressImage(file);
    if (compressed && (compressed.bytes < file.size || file.size > MAX_IMAGE_BYTES)) {
      return {
        compressed: true,
        attachment: {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg",
          mime: "image/jpeg",
          size: compressed.bytes,
          kind: "image",
          dataUrl: compressed.dataUrl,
        },
      };
    }
    if (file.size <= MAX_IMAGE_BYTES) {
      const dataUrl = await readAsDataUrl(file);
      return {
        attachment: {
          id: crypto.randomUUID(),
          name: file.name,
          mime: file.type || "image/png",
          size: file.size,
          kind: "image",
          dataUrl,
        },
      };
    }
    return { error: `${file.name}: image too large and could not be compressed` };
  }

  if (kind === "pdf") {
    if (file.size > MAX_PDF_BYTES)
      return { error: `${file.name}: PDF larger than 3MB` };
    const dataUrl = await readAsDataUrl(file);
    return {
      attachment: {
        id: crypto.randomUUID(),
        name: file.name,
        mime: "application/pdf",
        size: file.size,
        kind: "pdf",
        dataUrl,
      },
    };
  }

  // text
  if (file.size > MAX_TEXT_BYTES)
    return { error: `${file.name}: text file larger than 1MB` };
  const text = await readAsText(file);
  return {
    attachment: {
      id: crypto.randomUUID(),
      name: file.name,
      mime: file.type || "text/plain",
      size: file.size,
      kind: "text",
      text,
    },
  };
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
