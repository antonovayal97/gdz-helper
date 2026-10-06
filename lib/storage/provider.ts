/**
 * StorageProvider — abstraction for image storage.
 *
 * Implementations: LocalStorageProvider (dev), S3StorageProvider (future).
 * `upload` returns a storage key; `getUrl` turns that key into a public URL.
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

export interface StorageProvider {
  readonly name: string;
  upload(input: UploadInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
}
