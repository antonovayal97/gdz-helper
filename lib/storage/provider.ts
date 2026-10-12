/**
 * StorageProvider — abstraction for image storage.
 *
 * Implementations: LocalStorageProvider (dev), S3StorageProvider (prod, S3-compatible
 * providers such as AWS S3, Cloudflare R2, MinIO, Fil One).
 * `upload` returns a storage key; `getUrl` turns that key into a stable public URL
 * served through Next.js; `read` streams the object content back for the proxy route.
 */
export interface StoredFile {
  key: string;
  url: string;
}

export interface UploadInput {
  data: Buffer;
  mimeType: string;
  /** optional folder prefix, e.g. "solutions/2026/10" */
  folder?: string;
}

export interface StoredObject {
  data: Buffer;
  mimeType: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(input: UploadInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  /** Read object content by key (used by the /api/files proxy route). */
  read(key: string): Promise<StoredObject>;
}
