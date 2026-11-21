import { ConfigService } from '@nestjs/config';
import { S3Disk, type StorageModuleOptions } from '@nestjs/storage';

/** The disk (in MinIO, one bucket) that holds videos and their thumbnails. */
export const VIDEOS_DISK = 'videos';

/** `StorageModule` options: the `videos` disk points at MinIO (S3-compatible). */
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
