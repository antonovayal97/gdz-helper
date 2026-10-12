import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/config";
import { StorageProvider, StoredFile, StoredObject, UploadInput } from "./provider";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/jpg": "jpg",
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * LocalStorageProvider — stores files on the local disk (development).
 * Files are served through the Next.js route handler at /api/files/[...path].
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly rootDir: string;

  constructor() {
    // Runtime-only filesystem access (uploads): tell Turbopack not to trace it.
    this.rootDir = path.resolve(
      // turbopackIgnore: true
      process.cwd(),
      config.storage.localDir,
    );
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
    const folder = input.folder ?? "solutions";
    const key = `${folder}/${new Date().toISOString().slice(0, 7).replace(/[^\d-]/g, "")}/${randomUUID()}.${ext}`;

    const abs = path.join(this.rootDir, key);
    await mkdir(path.dirname(abs), { recursive: true });
    // Never follow symlinks: normalize and ensure the target stays inside root.
    const resolved = path.resolve(abs);
    if (!resolved.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error("Storage path traversal detected");
    }
    await writeFile(resolved, input.data);

    return { key, url: await this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const abs = path.join(this.rootDir, key);
    await rm(abs, { force: true });
  }

  async getUrl(key: string): Promise<string> {
    const base = config.app.url.replace(/\/$/, "");
    return `${base}/api/files/${key}`;
  }

  async read(key: string): Promise<StoredObject> {
    const abs = this.resolve(key);
    const mimeType = MIME_BY_EXT[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
    const data = await readFile(abs);
    return { data, mimeType };
  }

  /** Resolve a URL path like `2026/10/<id>.jpg` to an absolute disk path. */
  resolve(key: string): string {
    const abs = path.resolve(
      // turbopackIgnore: true
      this.rootDir,
      key,
    );
    if (!abs.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error("Storage path traversal detected");
    }
    return abs;
  }
}
