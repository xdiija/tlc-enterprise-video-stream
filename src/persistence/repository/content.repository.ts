import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContentEntity } from '@src/core/entity/content.entity.js';
import { MovieEntity } from '@src/core/entity/movie.entity.js';
import { ThumbnailEntity } from '@src/core/entity/thumbnail.entity.js';
import { VideoEntity } from '@src/core/entity/video.entity.js';
import { PrismaService } from '@src/persistence/prisma/prisma.service.js';

const contentInclude = Prisma.validator<Prisma.ContentInclude>()({
  Movie: {
    include: {
      Video: true,
      Thumbnail: true,
    },
  },
});

type ContentWithMovie = Prisma.ContentGetPayload<{
  include: typeof contentInclude;
}>;

@Injectable()
export class ContentRepository {
  private readonly model: PrismaService['content'];

  constructor(prismaService: PrismaService) {
    this.model = prismaService.content;
  }

  async create(content: ContentEntity): Promise<ContentEntity> {
    try {
      const movie = content.getMedia();
      if (!movie) {
        throw new Error('Movie must be provided');
      }
      const video = movie.getVideo();
      const thumbnail = movie.getThumbnail();

      await this.model.create({
        data: {
          id: content.getId(),
          title: content.getTitle(),
          description: content.getDescription(),
          type: content.getType(),
          createdAt: content.getCreatedAt(),
          updatedAt: content.getUpdatedAt(),
          Movie: {
            create: {
              id: movie.getId(),
              createdAt: movie.getCreatedAt(),
              updatedAt: movie.getUpdatedAt(),
              Video: {
                create: video.serialize(),
              },
              ...(thumbnail && {
                Thumbnail: { create: thumbnail.serialize() },
              }),
            },
          },
        },
      });
      return content;
    } catch (error) {
      this.handleAndThrowError(error);
    }
  }

  async findById(id: string): Promise<ContentEntity | undefined> {
    try {
      const content = await this.model.findUnique({
        where: { id },
        include: contentInclude,
      });
      if (!content) {
        return;
      }
      return this.mapToEntity(content);
    } catch (error) {
      this.handleAndThrowError(error);
    }
  }

  /** Deletes every content. Movies and videos go with it (cascade); thumbnails don't. */
  async clear(): Promise<{ count: number }> {
    try {
      return await this.model.deleteMany();
    } catch (error) {
      this.handleAndThrowError(error);
    }
  }

  private mapToEntity(content: ContentWithMovie): ContentEntity {
    const contentEntity = ContentEntity.createFrom({
      id: content.id,
      type: content.type,
      title: content.title,
      description: content.description,
      createdAt: new Date(content.createdAt),
      updatedAt: new Date(content.updatedAt),
    });

    const movie = content.Movie;
    if (movie?.Video) {
      contentEntity.addMedia(
        MovieEntity.createFrom({
          id: movie.id,
          createdAt: new Date(movie.createdAt),
          updatedAt: new Date(movie.updatedAt),
          video: VideoEntity.createFrom({
            id: movie.Video.id,
            url: movie.Video.url,
            duration: movie.Video.duration,
            sizeInKb: movie.Video.sizeInKb,
            createdAt: new Date(movie.Video.createdAt),
            updatedAt: new Date(movie.Video.updatedAt),
          }),
          thumbnail: movie.Thumbnail
            ? ThumbnailEntity.createFrom({
                id: movie.Thumbnail.id,
                url: movie.Thumbnail.url,
                createdAt: new Date(movie.Thumbnail.createdAt),
                updatedAt: new Date(movie.Thumbnail.updatedAt),
              })
            : undefined,
        }),
      );
    }
    return contentEntity;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'An unexpected error occurred.';
  }

  protected handleAndThrowError(error: unknown): never {
    const errorMessage = this.extractErrorMessage(error);
    if (error instanceof Prisma.PrismaClientValidationError) {
      throw new Error(error.message);
    }

    throw new Error(errorMessage);
  }
}
