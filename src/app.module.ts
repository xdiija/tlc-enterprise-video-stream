import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { StorageModule } from '@nestjs/storage';
import { ContentManagementService } from './core/service/content-management.service.js';
import { MediaPlayerService } from './core/service/media-player.service.js';
import { ContentController } from './http/rest/controller/content.controller.js';
import { MediaPlayerController } from './http/rest/controller/media-player.controller.js';
import { PrismaService } from './persistence/prisma/prisma.service.js';
import { ContentRepository } from './persistence/repository/content.repository.js';
import { VideoRepository } from './persistence/repository/video.repository.js';
import { MediaStorageService } from './persistence/storage/media-storage.service.js';
import { createStorageOptions } from './persistence/storage/storage.config.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Videos and thumbnails live in MinIO (S3-compatible), see persistence/storage.
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createStorageOptions,
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'recording',
    }),
  ],
  controllers: [ContentController, MediaPlayerController],
  providers: [
    PrismaService,
    ContentRepository,
    VideoRepository,
    MediaStorageService,
    ContentManagementService,
    MediaPlayerService,
  ],
})
export class AppModule {}
