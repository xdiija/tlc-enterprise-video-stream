import { BadRequestException } from '@nestjs/common';
import type { StoredUpload } from '@nestjs/storage';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentEntity, ContentType } from '@src/core/entity/content.entity.js';
import { MovieEntity } from '@src/core/entity/movie.entity.js';
import { ThumbnailEntity } from '@src/core/entity/thumbnail.entity.js';
import { VideoEntity } from '@src/core/entity/video.entity.js';
import { ContentManagementService } from '@src/core/service/content-management.service.js';
import { MediaStorageService } from '@src/persistence/storage/media-storage.service.js';
import { ContentController } from './content.controller.js';

function storedUpload(
  key: string,
  contentType: string,
  size = 100,
): StoredUpload {
  return {
    fieldname: '',
    originalname: '',
    encoding: '7bit',
    mimetype: contentType,
    size,
    key,
    contentType,
  };
}

describe('ContentController', () => {
  let controller: ContentController;
  const contentManagementService = { createContent: vi.fn() };
  const mediaStorageService = { delete: vi.fn(), stream: vi.fn() };

  const video = storedUpload('videos/a.mp4', 'video/mp4', 1430145);
  const thumbnail = storedUpload('thumbnails/a.jpg', 'image/jpeg');
  const contentData = { title: 'Title', description: 'Description' };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentController],
      providers: [
        {
          provide: ContentManagementService,
          useValue: contentManagementService,
        },
        { provide: MediaStorageService, useValue: mediaStorageService },
      ],
    }).compile();

    controller = module.get(ContentController);
  });

  describe('uploadVideo', () => {
    it('creates the content and returns it with the video key', async () => {
      const content = ContentEntity.createNew({
        ...contentData,
        type: ContentType.MOVIE,
        media: MovieEntity.createNew({
          video: VideoEntity.createNew({
            url: 'videos/a.mp4',
            sizeInKb: 1430145,
            duration: 100,
          }),
          thumbnail: ThumbnailEntity.createNew({ url: 'thumbnails/a.jpg' }),
        }),
      });
      contentManagementService.createContent.mockResolvedValue(content);

      await expect(
        controller.uploadVideo(contentData, {
          video: [video],
          thumbnail: [thumbnail],
        }),
      ).resolves.toEqual({
        id: content.getId(),
        title: 'Title',
        description: 'Description',
        url: 'videos/a.mp4',
        createdAt: content.getCreatedAt(),
        updatedAt: content.getUpdatedAt(),
      });

      expect(contentManagementService.createContent).toHaveBeenCalledWith({
        ...contentData,
        url: 'videos/a.mp4',
        thumbnailUrl: 'thumbnails/a.jpg',
        sizeInKb: 1430145,
      });
      expect(mediaStorageService.delete).not.toHaveBeenCalled();
    });

    it('deletes the stored video when the thumbnail is missing', async () => {
      await expect(
        controller.uploadVideo(contentData, { video: [video] }),
      ).rejects.toThrow(BadRequestException);

      expect(mediaStorageService.delete).toHaveBeenCalledWith(['videos/a.mp4']);
      expect(contentManagementService.createContent).not.toHaveBeenCalled();
    });

    it('rejects a file sent in the wrong field', async () => {
      await expect(
        controller.uploadVideo(contentData, {
          video: [thumbnail],
          thumbnail: [video],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mediaStorageService.delete).toHaveBeenCalledWith([
        'thumbnails/a.jpg',
        'videos/a.mp4',
      ]);
    });

    it('deletes the stored files when saving the content fails', async () => {
      contentManagementService.createContent.mockRejectedValue(
        new Error('database down'),
      );

      await expect(
        controller.uploadVideo(contentData, {
          video: [video],
          thumbnail: [thumbnail],
        }),
      ).rejects.toThrow('database down');

      expect(mediaStorageService.delete).toHaveBeenCalledWith([
        'videos/a.mp4',
        'thumbnails/a.jpg',
      ]);
    });
  });
});
