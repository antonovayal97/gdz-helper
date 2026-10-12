import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/[...path] — serve files through the active storage provider.
 * - Local provider: reads from disk.
 * - S3 provider: streams the object from the S3-compatible bucket (Fil One).
 * The key (relative path) is confined to the storage root; unknown objects → 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await params;
  const key = segments.join("/");

  const storage = getStorage();
  let obj;
  try {
    obj = await storage.read(key);
  } catch {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(obj.data), {
    headers: {
      "Content-Type": obj.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
