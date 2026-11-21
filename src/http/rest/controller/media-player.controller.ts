import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
} from '@nestjs/common';
import { VideoNotFoundException } from '@src/core/exception/video-not-found.exception.js';
import { MediaPlayerService } from '@src/core/service/media-player.service.js';
import { MediaStorageService } from '@src/persistence/storage/media-storage.service.js';
import type { Request, Response } from 'express';

@Controller('stream')
export class MediaPlayerController {
  constructor(
    private readonly mediaPlayerService: MediaPlayerService,
    private readonly mediaStorageService: MediaStorageService,
  ) {}

  @Get(':videoId')
  async streamVideo(
    // Video ids are UUID columns: anything else is a 400, not a database error.
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const url = await this.mediaPlayerService.prepareStreaming(videoId);
      // Reads from MinIO and answers `Range` requests with 206 Partial Content.
      return await this.mediaStorageService.stream(url, req, res);
    } catch (error) {
      // The core speaks in domain exceptions; translate them to HTTP here.
      if (error instanceof VideoNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
