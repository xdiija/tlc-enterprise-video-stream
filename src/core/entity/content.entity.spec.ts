import { ContentEntity, ContentType } from '@src/core/entity/content.entity.js';
import { MovieEntity } from '@src/core/entity/movie.entity.js';
import { ThumbnailEntity } from '@src/core/entity/thumbnail.entity.js';
import { VideoEntity } from '@src/core/entity/video.entity.js';

// Guards against fields being lost in subclasses (see the comment in BaseEntity).
describe('ContentEntity', () => {
  it('keeps every field of the content and its media', () => {
    const content = ContentEntity.createNew({
      title: 'Title',
      description: 'Description',
      type: ContentType.MOVIE,
      media: MovieEntity.createNew({
        video: VideoEntity.createNew({
          url: 'videos/a.mp4',
          sizeInKb: 10,
          duration: 100,
        }),
        thumbnail: ThumbnailEntity.createNew({ url: 'thumbnails/a.jpg' }),
      }),
    });

    expect(content.getId()).toEqual(expect.any(String));
    expect(content.getTitle()).toBe('Title');
    expect(content.getDescription()).toBe('Description');
    expect(content.getType()).toBe('MOVIE');
    expect(content.getCreatedAt()).toBeInstanceOf(Date);

    const movie = content.getMedia();
    expect(movie?.getVideo().getUrl()).toBe('videos/a.mp4');
    expect(movie?.getVideo().getSizeInKb()).toBe(10);
    expect(movie?.getVideo().getDuration()).toBe(100);
    expect(movie?.getThumbnail()?.getUrl()).toBe('thumbnails/a.jpg');
  });

  it('rebuilds an existing content with createFrom', () => {
    const createdAt = new Date('2023-01-01');
    const content = ContentEntity.createFrom({
      id: 'f3b1c0de-0000-4000-8000-000000000000',
      title: 'Title',
      description: 'Description',
      type: ContentType.TV_SHOW,
      createdAt,
      updatedAt: createdAt,
    });

    expect(content.serialize()).toEqual({
      id: 'f3b1c0de-0000-4000-8000-000000000000',
      title: 'Title',
      description: 'Description',
      type: 'TV_SHOW',
      media: undefined,
      createdAt,
      updatedAt: createdAt,
    });
  });
});
