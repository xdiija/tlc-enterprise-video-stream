import { Injectable, StreamableFile } from '@nestjs/common';
import { InjectDisk, serveFile, StorageDisk } from '@nestjs/storage';
import type { Request, Response } from 'express';
import { VIDEOS_DISK } from './storage.config.js';

/** Access to the files (videos and thumbnails) kept in MinIO. */
@Injectable()
export class MediaStorageService {
  constructor(
    @InjectDisk(VIDEOS_DISK) private readonly videosDisk: StorageDisk,
  ) {}

  /** Removes files from the bucket. Keys that don't exist are ignored. */
  async delete(keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.videosDisk.delete(keys);
    }
  }

  /**
   * Streams a file as the HTTP response. A `Range` request gets 206 Partial Content (what
   * lets a <video> element seek); a missing file is a 404.
   */
  async stream(
    key: string,
    req: Request,
    res: Response,
  ): Promise<StreamableFile | undefined> {
    return serveFile(this.videosDisk, key, {
      req,
      res,
      disposition: 'inline',
    });
  }
}
