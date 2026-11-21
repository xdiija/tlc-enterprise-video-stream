import {
  BaseEntity,
  type BaseEntityProps,
} from '@src/core/entity/base.entity.js';
import { ThumbnailEntity } from '@src/core/entity/thumbnail.entity.js';
import { VideoEntity } from '@src/core/entity/video.entity.js';
import { randomUUID } from 'crypto';

export interface MovieEntityProps extends BaseEntityProps {
  video: VideoEntity;
  thumbnail?: ThumbnailEntity;
}

export class MovieEntity extends BaseEntity {
  private video: MovieEntityProps['video'];
  private thumbnail?: MovieEntityProps['thumbnail'];

  private constructor(data: MovieEntityProps) {
    super(data);
    this.video = data.video;
    this.thumbnail = data.thumbnail;
  }

  static createNew(
    data: Omit<MovieEntityProps, 'id' | 'createdAt' | 'updatedAt'>,
    id = randomUUID(),
  ): MovieEntity {
    return new MovieEntity({
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static createFrom(data: MovieEntityProps): MovieEntity {
    return new MovieEntity({
      id: data.id,
      video: data.video,
      thumbnail: data.thumbnail,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  serialize() {
    return {
      id: this.id,
      video: this.video.serialize(),
      thumbnail: this.thumbnail?.serialize(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  addVideo(video: VideoEntity): void {
    this.video = video;
  }

  getVideo(): VideoEntity {
    return this.video;
  }

  addThumbnail(thumbnail: ThumbnailEntity): void {
    this.thumbnail = thumbnail;
  }

  getThumbnail(): ThumbnailEntity | undefined {
    return this.thumbnail;
  }
}
