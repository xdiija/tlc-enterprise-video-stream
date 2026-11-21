import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { StoredUpload } from '@nestjs/storage';
import { ContentManagementService } from '@src/core/service/content-management.service.js';
import { CreateVideoResponseDto } from '@src/http/rest/dto/response/create-video-response.dto.js';
import { RestResponseInterceptor } from '@src/http/rest/interceptor/rest-response.interceptor.js';
import {
  INVALID_FILE_TYPE_MESSAGE,
  THUMBNAIL_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE,
  VIDEO_UPLOAD_FIELDS,
  videoUploadOptions,
} from '@src/http/rest/upload/video-upload.options.js';
import { MediaStorageService } from '@src/persistence/storage/media-storage.service.js';

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentManagementService: ContentManagementService,
    private readonly mediaStorageService: MediaStorageService,
  ) {}

  @Post('video')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(VIDEO_UPLOAD_FIELDS, videoUploadOptions),
  )
  @UseInterceptors(new RestResponseInterceptor(CreateVideoResponseDto))
  async uploadVideo(
    @Body()
    contentData: {
      title: string;
      description: string;
    },
    @UploadedFiles()
    files: { video?: StoredUpload[]; thumbnail?: StoredUpload[] },
  ): Promise<CreateVideoResponseDto> {
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
      // The upload only checked each file is one of the allowed types; make sure each
      // field got the right one (e.g. not a JPEG sent as the video).
      if (
        videoFile.contentType !== VIDEO_CONTENT_TYPE ||
        thumbnailFile.contentType !== THUMBNAIL_CONTENT_TYPE
      ) {
        throw new BadRequestException(INVALID_FILE_TYPE_MESSAGE);
      }

      const createdContent = await this.contentManagementService.createContent({
        title: contentData.title,
        description: contentData.description,
        // Object keys in the MinIO bucket, not file-system paths.
        url: videoFile.key,
        thumbnailUrl: thumbnailFile.key,
        sizeInKb: videoFile.size,
      });
      const video = createdContent.getMedia()?.getVideo();
      if (!video) {
        throw new BadRequestException('Video must be present');
      }

      return {
        id: createdContent.getId(),
        title: createdContent.getTitle(),
        description: createdContent.getDescription(),
        url: video.getUrl(),
        createdAt: createdContent.getCreatedAt(),
        updatedAt: createdContent.getUpdatedAt(),
      };
    } catch (error) {
      // The files are already in the bucket at this point; don't leave orphans behind.
      await this.mediaStorageService.delete(storedKeys);
      throw error;
    }
  }
}
