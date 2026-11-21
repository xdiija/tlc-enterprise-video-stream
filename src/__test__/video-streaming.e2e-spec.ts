import { HttpStatus, INestApplication } from '@nestjs/common';
import { InMemoryDisk, STORAGE_MODULE_OPTIONS } from '@nestjs/storage';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';
import { ContentManagementService } from '@src/core/service/content-management.service.js';
import { PrismaService } from '@src/persistence/prisma/prisma.service.js';
import { ContentRepository } from '@src/persistence/repository/content.repository.js';
import { VIDEOS_DISK } from '@src/persistence/storage/storage.config.js';
import fs from 'fs';
import request from 'supertest';

describe('MediaPlayerController (e2e)', () => {
  let module: TestingModule;
  let app: INestApplication;
  let contentManagementService: ContentManagementService;
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

    contentManagementService = module.get(ContentManagementService);
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

  describe('GET /stream/:videoId', () => {
    it('streams a video', async () => {
      // Put the files in storage first, the way an upload would.
      await videosDisk.put(
        'videos/sample.mp4',
        fs.readFileSync('./test/fixtures/sample.mp4'),
        { contentType: 'video/mp4' },
      );
      await videosDisk.put(
        'thumbnails/sample.jpg',
        fs.readFileSync('./test/fixtures/sample.jpg'),
        { contentType: 'image/jpeg' },
      );
      const createContent = await contentManagementService.createContent({
        title: 'Test Video',
        description: 'This is a test video',
        url: 'videos/sample.mp4',
        thumbnailUrl: 'thumbnails/sample.jpg',
        sizeInKb: 1430145,
      });

      const fileSize = 1430145;
      const range = `bytes=0-${fileSize - 1}`;

      const response = await request(app.getHttpServer())
        .get(`/stream/${createContent.getMedia()?.getVideo().getId()}`)
        .set('Range', range)
        .expect(HttpStatus.PARTIAL_CONTENT);

      expect(response.headers['content-range']).toBe(
        `bytes 0-${fileSize - 1}/${fileSize}`,
      );
      expect(response.headers['accept-ranges']).toBe('bytes');
      expect(response.headers['content-length']).toBe(String(fileSize));
      expect(response.headers['content-type']).toBe('video/mp4');
    });

    it('returns 404 if the video is not found', async () => {
      await request(app.getHttpServer())
        .get('/stream/45705b56-a47f-4869-b736-8f6626c940f8')
        .expect(HttpStatus.NOT_FOUND)
        .expect({
          message:
            'video with id 45705b56-a47f-4869-b736-8f6626c940f8 not found',
          error: 'Not Found',
          statusCode: 404,
        });
    });

    it('returns 400 if the video id is not a UUID', async () => {
      await request(app.getHttpServer())
        .get('/stream/not-a-uuid')
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
