import { config } from "@/config";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "IMAGE_TOO_LARGE" | "INVALID_IMAGE_TYPE" = "INVALID_IMAGE_TYPE",
  ) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/** Decode a base64 data URL into a Buffer + mime type. Returns null when malformed. */
export function parseDataUrl(value: string): { data: Buffer; mimeType: string } | null {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) return null;
  return { mimeType: match[1], data: Buffer.from(match[2], "base64") };
}

/** Sniff real file magic bytes so a fake MIME in the data URL can't pass. */
function sniffMime(data: Buffer): string | null {
  if (!data || data.length < 4) return null;
  // JPEG: FF D8 FF
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  )
    return "image/png";
  // WEBP: "RIFF" .... "WEBP"
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export interface ValidatedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Validate an uploaded image (all checks are re-done server-side;
 * the client may optimize first but the server never trusts it).
 */
export function validateImage(dataUrl: string): ValidatedImage {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new ImageValidationError("Некорректные данные изображения");
  }
  const { data, mimeType } = parsed;

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new ImageValidationError("Неподдерживаемый тип файла. Разрешены JPEG, PNG, WEBP.");
  }

  const maxBytes = config.limits.maxUploadBytes;
  if (data.byteLength > maxBytes) {
    throw new ImageValidationError(
      `Фото слишком большое. Максимальный размер — ${Math.ceil(maxBytes / (1024 * 1024))} МБ.`,
      "IMAGE_TOO_LARGE",
    );
  }

  const sniffed = sniffMime(data);
  if (!sniffed || sniffed !== mimeType) {
    throw new ImageValidationError("Содержимое файла не соответствует заявленному типу.");
  }

  if (data.byteLength > config.ai.maxImageBytes) {
    throw new ImageValidationError(
      "Файл слишком большой для обработки. Попробуйте фото меньшего размера.",
      "IMAGE_TOO_LARGE",
    );
  }

  return { data, mimeType };
}
