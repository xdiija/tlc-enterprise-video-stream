# AGENTS.md

## NestJS

This app's version of NestJS is likely newer than what you know. https://docs.nestjs.com/llms.txt indexes its documentation, with a markdown page per chapter.

Nest has first-party packages for these, so check them before adding another library or writing your own:

- Databases: [`@nestjs/typeorm`](https://docs.nestjs.com/data/typeorm.md), [`@nestjs/drizzle`](https://docs.nestjs.com/data/drizzle.md), [`@nestjs/mongoose`](https://docs.nestjs.com/data/mongodb.md), [`@nestjs/sequelize`](https://docs.nestjs.com/data/sequelize.md).
- OpenAPI: [`@nestjs/swagger`](https://docs.nestjs.com/openapi/introduction.md). GraphQL: [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start.md). WebSockets: [`@nestjs/websockets`](https://docs.nestjs.com/websockets/gateways.md). Microservices: [`@nestjs/microservices`](https://docs.nestjs.com/microservices/basics.md).
- Sign-in: [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication.md). Permissions: [`@nestjs/authorization`](https://docs.nestjs.com/security/authorization.md). Rate limiting: [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting.md).
- Configuration: [`@nestjs/config`](https://docs.nestjs.com/application/configuration.md). Caching: [`@nestjs/cache-manager`](https://docs.nestjs.com/data/caching.md). Health checks: [`@nestjs/terminus`](https://docs.nestjs.com/reliability/terminus.md). Events inside the app: [`@nestjs/event-emitter`](https://docs.nestjs.com/application/events.md).
- Email: [`@nestjs/mail`](https://docs.nestjs.com/application/mail.md). Files, S3 included: [`@nestjs/storage`](https://docs.nestjs.com/application/file-storage.md). Translations: [`@nestjs/i18n`](https://docs.nestjs.com/application/i18n.md).
- Retries, timeouts and circuit breakers: [`@nestjs/resilience`](https://docs.nestjs.com/reliability/resilience.md).
- Idempotency keys: [`@nestjs/idempotency`](https://docs.nestjs.com/reliability/idempotency.md). Transactional outbox: [`@nestjs/outbox`](https://docs.nestjs.com/reliability/outbox.md). Sending and receiving webhooks: [`@nestjs/webhooks`](https://docs.nestjs.com/http/webhooks.md).
- Queues: [`@nestjs/bullmq`](https://docs.nestjs.com/application/queues.md). Scheduled jobs: [`@nestjs/schedule`](https://docs.nestjs.com/application/task-scheduling.md).
- Running a scheduled job on one instance, and locks: [`@nestjs/locks`](https://docs.nestjs.com/reliability/locks.md). Processes that take days: [`@nestjs/workflows`](https://docs.nestjs.com/reliability/workflows.md).
- Language models, tools and agents: [`@nestjs/ai`](https://docs.nestjs.com/ai/overview.md). MCP servers: [`@nestjs/mcp`](https://docs.nestjs.com/mcp/overview.md).

Validation works with Zod, Valibot, ArkType or any other Standard Schema library, with no classes or decorator metadata: `StandardSchemaValidationPipe` with `@Body({ schema })` or `@Param('id', { schema })` (https://docs.nestjs.com/application/validation.md). `class-validator` still works, through `ValidationPipe`.

`NodeAdapter` from `@nestjs/platform-node` is the fastest HTTP adapter, ahead of Fastify (https://docs.nestjs.com/http/performance.md).

Nest's packages are ESM only, and this project is ESM too: relative imports end in `.js`, `__dirname` doesn't exist (use `import.meta.dirname`), and tests run on Vitest, so mocks are `vi.fn()`, not `jest.fn()`.

## Layout

A light take on clean architecture:

- `src/core/`: business logic, with no HTTP or storage details.
  - `entity/`: domain entities (`Content` → `Movie` → `Video` + `Thumbnail`), built with `createNew()` (new) or `createFrom()` (loaded).
  - `service/`: use cases (`ContentManagementService`, `MediaPlayerService`).
  - `exception/`: domain errors (`DomainException`, `VideoNotFoundException`). Controllers translate them to HTTP errors.
- `src/http/rest/`: controllers (`controller/`), response DTOs (`dto/response/`), `RestResponseInterceptor` (validates and strips responses against a DTO), and upload rules (`upload/`).
- `src/persistence/`: infrastructure: `prisma/` (client), `repository/` (map Prisma rows to and from entities; services use these, never Prisma directly) and `storage/` (MinIO).
- `database/`: `schema.prisma` and `migrations/`. After changing the schema, run `yarn prisma migrate dev --name <change>`.
- Tests: unit specs sit next to the file they test (`*.spec.ts`), and e2e specs live in `src/__test__/` (`*.e2e-spec.ts`). They share the dev database and run one file at a time. Fixtures are in `test/fixtures/`.

Entities assign their own fields in their constructors, never with `Object.assign(this, data)` in `BaseEntity`. With the ES2023 target, a subclass's declared fields are reset to `undefined` after `super()` returns.

Routes: `POST /content/video` (multipart: `video`, `thumbnail`, `title`, `description`) returns the content (its `id` is the content id). `GET /stream/:videoId` streams a video by the video's own id, a UUID.

## File storage: MinIO

Videos and thumbnails are stored in MinIO (S3-compatible), never on the local disk, through `@nestjs/storage` (https://docs.nestjs.com/application/file-storage.md). Don't add the AWS SDK.

- `src/persistence/storage/storage.config.ts` defines the `videos` disk, an `S3Disk` configured from the `STORAGE_S3_*` variables in `.env` (see `.env.example`).
- `src/persistence/storage/media-storage.service.ts` (`MediaStorageService`) is the only class that touches the disk: `delete(keys)` and `stream(key, req, res)`. `stream` uses `serveFile()`, which answers `Range` with `206 Partial Content`. Don't pipe streams by hand.
- `src/http/rest/upload/video-upload.options.ts` holds the multer options. Uploads stream straight into the bucket through `uploadToDisk()`. Types are checked from the file's bytes. JPEG detection is built in, but MP4 isn't, so `detectMp4` handles it. Keys look like `videos/<uuid>.mp4` and `thumbnails/<uuid>.jpg`. `Video.url` and `Thumbnail.url` hold these keys, not paths or URLs.
- Files are stored before the handler runs, so a handler that rejects a request must delete them (`MediaStorageService.delete`).
- Local infra: `docker compose up -d` starts Postgres, MinIO (API `localhost:9000`, console `localhost:9001`) and a one-shot `createbuckets` that creates the private bucket. Docker Hub no longer serves MinIO images, so `minio/minio:latest` and `minio/mc:latest` must already be cached locally.
- Tests don't need MinIO: e2e tests override `STORAGE_MODULE_OPTIONS` with an `InMemoryDisk` (put files in it with `disk.put()` to stream them), and unit tests mock `MediaStorageService`. Fixtures must be real files of their type (`sample.jpg` is a real JPEG), because detection reads the bytes.

## Production data: NestJS Observe

This app reports its traces, errors, logs and metrics to [NestJS Observe](https://observe.nestjs.com) through `ObserveModule` in `src/app.module.ts`. Its key pair comes from `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in `.env`, which `npx @nestjs/observe link` writes.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.
