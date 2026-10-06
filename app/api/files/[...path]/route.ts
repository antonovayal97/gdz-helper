import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import { LocalStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * GET /api/files/[...path] — serve files stored by LocalStorageProvider.
 * Only image extensions are allowed; paths are confined to the storage root.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params;
  const storage = getStorage();

  if (storage.name !== "local") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  const relative = segments.join("/");
  const ext = path.extname(relative).toLowerCase();
  if (!CONTENT_TYPE[ext]) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  let abs: string;
  try {
    abs = (storage as LocalStorageProvider).resolve(relative);
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  const stream = createReadStream(abs);
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", () => controller.error(new Error("stream error")));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": CONTENT_TYPE[ext],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
