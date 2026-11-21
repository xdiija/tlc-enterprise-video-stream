import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VideoNotFoundException } from '@src/core/exception/video-not-found.exception.js';
import { MediaPlayerService } from '@src/core/service/media-player.service.js';
import { MediaStorageService } from '@src/persistence/storage/media-storage.service.js';
import type { Request, Response } from 'express';
import { MediaPlayerController } from './media-player.controller.js';

describe('MediaPlayerController', () => {
  let controller: MediaPlayerController;
  const mediaPlayerService = { prepareStreaming: vi.fn() };
  const mediaStorageService = { delete: vi.fn(), stream: vi.fn() };
  const req = {} as Request;
  const res = {} as Response;

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaPlayerController],
      providers: [
        { provide: MediaPlayerService, useValue: mediaPlayerService },
        { provide: MediaStorageService, useValue: mediaStorageService },
      ],
    }).compile();

    controller = module.get(MediaPlayerController);
  });

  it('streams the video stored under its url', async () => {
    mediaPlayerService.prepareStreaming.mockResolvedValue('videos/a.mp4');

    await controller.streamVideo('1', req, res);

    expect(mediaStorageService.stream).toHaveBeenCalledWith(
      'videos/a.mp4',
      req,
      res,
    );
  });

  it('throws 404 when the video does not exist', async () => {
    mediaPlayerService.prepareStreaming.mockRejectedValue(
      new VideoNotFoundException('video with id 1 not found'),
    );

    const result = controller.streamVideo('1', req, res);

    await expect(result).rejects.toThrow(NotFoundException);
    await expect(result).rejects.toThrow('video with id 1 not found');
    expect(mediaStorageService.stream).not.toHaveBeenCalled();
  });

  it('rethrows errors that are not domain exceptions', async () => {
    mediaPlayerService.prepareStreaming.mockRejectedValue(
      new Error('database down'),
    );

    await expect(controller.streamVideo('1', req, res)).rejects.toThrow(
      'database down',
    );
  });
});
