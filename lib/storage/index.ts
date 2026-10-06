import { config } from "@/config";
import { StorageProvider } from "./provider";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";

export type { StorageProvider, StoredFile, UploadInput } from "./provider";
export { LocalStorageProvider, S3StorageProvider };

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  cached = config.storage.provider === "s3" ? new S3StorageProvider() : new LocalStorageProvider();
  return cached;
}
