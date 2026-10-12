import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { config } from "@/config";
import { StorageProvider, StoredFile, StoredObject, UploadInput } from "./provider";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/jpg": "jpg",
};

/**
 * S3StorageProvider — writes objects to any S3-compatible storage.
 * Fil One (https://app.fil.one) requires path-style addressing, which is
 * enabled here via `forcePathStyle`. Buckets are private by default, so
 * files are served through the Next.js proxy route at /api/files/[...path]
 * (see `getUrl`/`read`) — this keeps the stored URL stable and non-expiring.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const { endpoint, accessKey, secretKey, bucket, region } = config.storage.s3;
    if (!bucket) throw new Error("STORAGE_BUCKET is required when STORAGE_PROVIDER=s3");
    if (!endpoint) throw new Error("STORAGE_ENDPOINT is required when STORAGE_PROVIDER=s3");
    if (!accessKey || !secretKey)
      throw new Error("STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY are required when STORAGE_PROVIDER=s3");

    this.bucket = bucket;
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    const ext = EXT_BY_MIME[input.mimeType] ?? "bin";
    const folder = input.folder ?? "solutions";
    const key = `${folder}/${new Date().toISOString().slice(0, 7).replace(/[^\d-]/g, "")}/${randomUUID()}.${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.data,
        ContentType: input.mimeType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    return { key, url: await this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getUrl(key: string): Promise<string> {
    const base = config.app.url.replace(/\/$/, "");
    return `${base}/api/files/${key}`;
  }

  async read(key: string): Promise<StoredObject> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const data = Buffer.from(await res.Body!.transformToByteArray());
    const mimeType = res.ContentType ?? "application/octet-stream";
    return { data, mimeType };
  }
}
