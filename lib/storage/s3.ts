import { config } from "@/config";
import { StorageProvider, StoredFile, UploadInput } from "./provider";

/**
 * S3StorageProvider — placeholder for the future S3-compatible storage
 * (AWS S3, Cloudflare R2, MinIO, ...).
 *
 * To wire it up install `@aws-sdk/client-s3` and implement upload/delete/getUrl
 * using config.storage.s3.* — no business logic changes are required.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";

  constructor() {
    if (!config.storage.s3.bucket) {
      throw new Error("STORAGE_BUCKET is required when STORAGE_PROVIDER=s3");
    }
  }

  async upload(_input: UploadInput): Promise<StoredFile> {
    throw new Error(
      "S3 storage is not implemented yet. Use LocalStorageProvider (STORAGE_PROVIDER=local) for development.",
    );
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3 storage is not implemented yet.");
  }

  async getUrl(key: string): Promise<string> {
    return `https://${config.storage.s3.bucket}.s3.amazonaws.com/${key}`;
  }
}
