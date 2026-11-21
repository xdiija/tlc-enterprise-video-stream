import { Injectable } from '@nestjs/common';
import { ContentEntity, ContentType } from '@src/core/entity/content.entity.js';
import { MovieEntity } from '@src/core/entity/movie.entity.js';
import { ThumbnailEntity } from '@src/core/entity/thumbnail.entity.js';
import { VideoEntity } from '@src/core/entity/video.entity.js';
import { ContentRepository } from '@src/persistence/repository/content.repository.js';

export interface CreateContentData {
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  sizeInKb: number;
}

@Injectable()
export class ContentManagementService {
  constructor(private readonly contentRepository: ContentRepository) {}

  async createContent(
    createContentData: CreateContentData,
  ): Promise<ContentEntity> {
    const content = ContentEntity.createNew({
      title: createContentData.title,
      description: createContentData.description,
      type: ContentType.MOVIE,
      media: MovieEntity.createNew({
        video: VideoEntity.createNew({
          url: createContentData.url,
          sizeInKb: createContentData.sizeInKb,
          duration: 100,
        }),
        thumbnail: ThumbnailEntity.createNew({
          url: createContentData.thumbnailUrl,
        }),
      }),
    });
    await this.contentRepository.create(content);
    return content;
  }
}
