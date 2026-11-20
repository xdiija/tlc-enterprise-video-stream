import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  InjectDisk,
  serveFile,
  StorageDisk,
  uploadToDisk,
  type StoredUpload,
} from '@nestjs/storage';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma.service.js';
import {
  detectMp4,
  THUMBNAIL_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  VIDEOS_DISK,
} from './storage.config.js';

const INVALID_TYPE_MESSAGE =
  'Invalid file type. Only video/mp4 and image/jpeg are supported.';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaService: PrismaService,
    @InjectDisk(VIDEOS_DISK) private readonly videosDisk: StorageDisk,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('video')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
      ],
      {
        // Streams each file straight into MinIO; nothing is written to the local disk.
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
            return cb(new BadRequestException(INVALID_TYPE_MESSAGE), false);
          }
          return cb(null, true);
        },
      },
    ),
  )
  async uploadVideo(
    @Body()
    contentData: {
      title: string;
      description: string;
    },
    @UploadedFiles()
    files: { video?: StoredUpload[]; thumbnail?: StoredUpload[] },
  ): Promise<any> {
    const videoFile = files.video?.[0];
    const thumbnailFile = files.thumbnail?.[0];
    const storedKeys = [videoFile?.key, thumbnailFile?.key].filter(
      (key): key is string => key !== undefined,
    );

    try {
      if (!videoFile || !thumbnailFile) {
        throw new BadRequestException(
          'Both video and thumbnail files are required.',
        );
      }
      // The engine only checked each file is one of the allowed types; make sure each
      // field got the right one (e.g. not a JPEG sent as the video).
      if (
        videoFile.contentType !== VIDEO_CONTENT_TYPE ||
        thumbnailFile.contentType !== THUMBNAIL_CONTENT_TYPE
      ) {
        throw new BadRequestException(INVALID_TYPE_MESSAGE);
      }

      return await this.prismaService.video.create({
        data: {
          id: randomUUID(),
          title: contentData.title,
          description: contentData.description,
          // Object keys in the bucket, not file-system paths.
          url: videoFile.key,
          thumbnailUrl: thumbnailFile.key,
          sizeInKb: videoFile.size,
          duration: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // Files are already in the bucket at this point; don't leave orphans behind.
      await this.videosDisk.delete(storedKeys);
      throw error;
    }
  }

  @Get('stream/:videoId')
  async streamVideo(
    @Param('videoId') videoId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const video = await this.prismaService.video.findUnique({
      where: {
        id: videoId,
      },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    // Reads from MinIO and answers `Range` requests with 206 Partial Content,
    // which is what lets a <video> element seek.
    return serveFile(this.videosDisk, video.url, {
      req,
      res,
      disposition: 'inline',
    });
  }
}
