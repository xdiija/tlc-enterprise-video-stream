import { BadRequestException } from '@nestjs/common';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import { uploadToDisk } from '@nestjs/storage';
import { VIDEOS_DISK } from '@src/persistence/storage/storage.config.js';
import { randomUUID } from 'crypto';

export const VIDEO_CONTENT_TYPE = 'video/mp4';
export const THUMBNAIL_CONTENT_TYPE = 'image/jpeg';

export const INVALID_FILE_TYPE_MESSAGE =
  'Invalid file type. Only video/mp4 and image/jpeg are supported.';

/** The multipart fields of a video upload. */
export const VIDEO_UPLOAD_FIELDS = [
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
];

/**
 * The storage's built-in detection recognizes JPEG by its bytes but not MP4. An MP4 (ISO base
 * media file) has a box size followed by `ftyp` at byte 4.
 */
export function detectMp4(bytes: Buffer): string | undefined {
  return bytes.length >= 8 && bytes.toString('latin1', 4, 8) === 'ftyp'
    ? VIDEO_CONTENT_TYPE
    : undefined;
}

/** Multer options for `FileFieldsInterceptor`: each file streams straight into MinIO. */
export const videoUploadOptions: MulterModuleOptions = {
  storage: uploadToDisk({
    disk: VIDEOS_DISK,
    // Checked against the file's bytes (not the client's claim) before anything is stored.
    contentTypes: [VIDEO_CONTENT_TYPE, THUMBNAIL_CONTENT_TYPE],
    detectContentType: detectMp4,
    key: (file) =>
      `${file.fieldname === 'video' ? 'videos' : 'thumbnails'}/${randomUUID()}${file.extension}`,
  }),
  // Fast rejection based on the declared type, before the upload starts streaming.
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype !== VIDEO_CONTENT_TYPE &&
      file.mimetype !== THUMBNAIL_CONTENT_TYPE
    ) {
      return cb(new BadRequestException(INVALID_FILE_TYPE_MESSAGE), false);
    }
    return cb(null, true);
  },
};
