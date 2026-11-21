import { Injectable } from '@nestjs/common';
import { VideoNotFoundException } from '@src/core/exception/video-not-found.exception.js';
import { VideoRepository } from '@src/persistence/repository/video.repository.js';

@Injectable()
export class MediaPlayerService {
  constructor(private readonly videoRepository: VideoRepository) {}

  /** The storage key of the video to stream. */
  async prepareStreaming(videoId: string): Promise<string> {
    const video = await this.videoRepository.findById(videoId);
    if (!video) {
      throw new VideoNotFoundException(`video with id ${videoId} not found`);
    }
    return video.getUrl();
  }
}
