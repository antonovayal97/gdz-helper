"use client";

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

const MAX_DIMENSION = 1800; // long edge, px
const JPEG_QUALITY = 0.82;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB before optimization

export class ClientImageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "UNSUPPORTED_TYPE"
      | "TOO_LARGE"
      | "EMPTY"
      | "DECODE_FAILED"
      | "OPTIMIZE_FAILED" = "OPTIMIZE_FAILED",
  ) {
    super(message);
    this.name = "ClientImageError";
  }
}

export interface OptimizedImage {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

function assertSupported(file: File): void {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    throw new ClientImageError(
      "Неподдерживаемый формат. Разрешены JPG, PNG, WEBP.",
      "UNSUPPORTED_TYPE",
    );
  }
  if (file.size > MAX_BYTES) {
    throw new ClientImageError(
      `Фото слишком большое. Максимальный размер — ${Math.round(MAX_BYTES / (1024 * 1024))} МБ.`,
      "TOO_LARGE",
    );
  }
  if (file.size === 0) {
    throw new ClientImageError("Файл пустой.", "EMPTY");
  }
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ClientImageError("Не удалось открыть изображение.", "DECODE_FAILED"));
    };
    img.src = url;
  });
}

/**
 * Optimize an image before upload:
 *  - validates type & size,
 *  - downscales the long edge,
 *  - re-encodes on a canvas (this strips EXIF metadata),
 *  - returns a base64 data URL.
 */
export async function optimizeImage(file: File): Promise<OptimizedImage> {
  assertSupported(file);

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new ClientImageError("Не удалось обработать изображение.", "OPTIMIZE_FAILED");
  }
  if (img.naturalWidth !== width || img.naturalHeight !== height) {
    // Downscale with smoothing.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(img, 0, 0, width, height);

  // Re-encode to JPEG unless the image has transparency (PNG with alpha → keep PNG).
  // JPEG re-encoding strips EXIF.
  const hasAlpha =
    file.type === "image/png" || file.type === "image/webp"
      ? canvasPixelHasAlpha(ctx, width, height)
      : false;

  const mimeType: string = hasAlpha ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, hasAlpha ? undefined : JPEG_QUALITY);

  // Rough size estimate after encoding.
  const base64 = dataUrl.split(",")[1] ?? "";
  const sizeBytes = Math.round((base64.length * 3) / 4);

  if (sizeBytes > MAX_BYTES) {
    throw new ClientImageError(
      `Фото слишком большое. Максимальный размер — ${Math.round(MAX_BYTES / (1024 * 1024))} МБ.`,
      "TOO_LARGE",
    );
  }

  return { dataUrl, mimeType, width, height, sizeBytes };
}

function canvasPixelHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  // Sample a small grid instead of the whole image.
  const step = Math.max(8, Math.floor(Math.min(width, height) / 32));
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4 * step) {
    if (data[i] < 255) return true;
  }
  return false;
}
