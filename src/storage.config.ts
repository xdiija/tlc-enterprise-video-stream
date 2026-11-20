import { ConfigService } from '@nestjs/config';
import { S3Disk, type StorageModuleOptions } from '@nestjs/storage';

/** The disk (in MinIO, one bucket) that holds videos and their thumbnails. */
export const VIDEOS_DISK = 'videos';

export const VIDEO_CONTENT_TYPE = 'video/mp4';
export const THUMBNAIL_CONTENT_TYPE = 'image/jpeg';

export function createStorageOptions(
  config: ConfigService,
): StorageModuleOptions {
  return {
    default: VIDEOS_DISK,
    disks: {
      [VIDEOS_DISK]: new S3Disk({
        endpoint: config.getOrThrow<string>('STORAGE_S3_ENDPOINT'),
        region: config.get<string>('STORAGE_S3_REGION', 'us-east-1'),
        bucket: config.getOrThrow<string>('STORAGE_S3_BUCKET'),
        forcePathStyle: true, // MinIO serves buckets at /<bucket>, not as subdomains
        credentials: {
          accessKeyId: config.getOrThrow<string>('STORAGE_S3_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow<string>('STORAGE_S3_SECRET_KEY'),
        },
      }),
    },
  };
}

/**
 * The storage's built-in detection recognizes JPEG by its bytes but not MP4. An MP4 (ISO base
 * media file) has a box size followed by `ftyp` at byte 4.
 */
export function detectMp4(bytes: Buffer): string | undefined {
  return bytes.length >= 8 && bytes.toString('latin1', 4, 8) === 'ftyp'
    ? VIDEO_CONTENT_TYPE
    : undefined;
}
