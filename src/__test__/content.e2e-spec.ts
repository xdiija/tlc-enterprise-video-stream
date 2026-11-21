import { HttpStatus, INestApplication } from '@nestjs/common';
import { InMemoryDisk, STORAGE_MODULE_OPTIONS } from '@nestjs/storage';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';
import { PrismaService } from '@src/persistence/prisma/prisma.service.js';
import { ContentRepository } from '@src/persistence/repository/content.repository.js';
import { VIDEOS_DISK } from '@src/persistence/storage/storage.config.js';
import request from 'supertest';

describe('ContentController (e2e)', () => {
  let module: TestingModule;
  let app: INestApplication;
  let contentRepository: ContentRepository;
  let prismaService: PrismaService;
  // Stands in for MinIO, so the tests don't need it running.
  const videosDisk = new InMemoryDisk();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(STORAGE_MODULE_OPTIONS)
      .useValue({ default: VIDEOS_DISK, disks: { [VIDEOS_DISK]: videosDisk } })
      .compile();

    app = module.createNestApplication();
    await app.init();

    contentRepository = module.get(ContentRepository);
    prismaService = module.get(PrismaService);
  });

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2023-01-01'));
  });

  afterEach(async () => {
    vi.useRealTimers();
    // Deleting a content cascades to its movie and video; thumbnails are separate rows.
    await contentRepository.clear();
    await prismaService.thumbnail.deleteMany();
    videosDisk.clear();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('/content/video (POST)', () => {
    it('uploads a video', async () => {
      const video = {
        title: 'Test Video',
        description: 'This is a test video',
        sizeInKb: 1430145,
        duration: 100,
      };

      const response = await request(app.getHttpServer())
        .post('/content/video')
        .attach('video', './test/fixtures/sample.mp4')
        .attach('thumbnail', './test/fixtures/sample.jpg')
        .field('title', video.title)
        .field('description', video.description)
        .expect(HttpStatus.CREATED);

      // Only the fields CreateVideoResponseDto exposes are returned.
      expect(response.body).toEqual({
        id: expect.any(String),
        title: video.title,
        description: video.description,
        url: expect.stringMatching(/^videos\/.+\.mp4$/),
        createdAt: expect.stringMatching(/^2023-01-01T/),
        updatedAt: expect.stringMatching(/^2023-01-01T/),
      });

      // The content is saved as a movie, with its video and thumbnail.
      const saved = await contentRepository.findById(response.body.id);
      const movie = saved?.getMedia();
      expect(saved?.getType()).toBe('MOVIE');
      expect(movie?.getVideo().getUrl()).toBe(response.body.url);
      expect(movie?.getVideo().getSizeInKb()).toBe(video.sizeInKb);
      expect(movie?.getVideo().getDuration()).toBe(video.duration);
      const thumbnailUrl = movie?.getThumbnail()?.getUrl();
      expect(thumbnailUrl).toMatch(/^thumbnails\/.+\.jpg$/);

      // Both files are in storage, under the saved keys.
      expect(videosDisk.keys()).toEqual(
        expect.arrayContaining([response.body.url, thumbnailUrl]),
      );
      expect(videosDisk.keys()).toHaveLength(2);
    });

    it('throws an error when the thumbnail is not provided', async () => {
      await request(app.getHttpServer())
        .post('/content/video')
        .attach('video', './test/fixtures/sample.mp4')
        .field('title', 'Test Video')
        .field('description', 'This is a test video')
        .expect(HttpStatus.BAD_REQUEST)
        .expect((response) => {
          expect(response.body).toMatchObject({
            message: 'Both video and thumbnail files are required.',
            error: 'Bad Request',
            statusCode: 400,
          });
        });

      // The video that did arrive is removed from storage.
      expect(videosDisk.keys()).toEqual([]);
    });

    it('does not allow non mp4 files', async () => {
      await request(app.getHttpServer())
        .post('/content/video')
        .attach('video', './test/fixtures/sample.mp3')
        .attach('thumbnail', './test/fixtures/sample.jpg')
        .field('title', 'Test Video')
        .field('description', 'This is a test video')
        .expect(HttpStatus.BAD_REQUEST)
        .expect({
          message:
            'Invalid file type. Only video/mp4 and image/jpeg are supported.',
          error: 'Bad Request',
          statusCode: 400,
        });
    });
  });
});
