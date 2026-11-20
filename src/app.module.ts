import { HealthModule, redisIndicator, type HealthModuleOptions } from '@cadenway/nest-common';
import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import { Module, type Type } from '@nestjs/common';

import { RedisModule } from './infrastructure/redis/redis.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { SavedViewsModule } from './modules/saved-views/saved-views.module.js';
import { TaskTemplatesModule } from './modules/task-templates/task-templates.module.js';
import { DependenciesModule } from './modules/dependencies/dependencies.module.js';
import { WatchersModule } from './modules/watchers/watchers.module.js';
import { CommentsModule } from './modules/comments/comments.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module.js';
import { ArchivesModule } from './modules/archives/archives.module.js';
import { AuthRoutesModule } from './modules/auth-routes/auth-routes.module.js';
import { InvitationsModule } from './modules/invitations/invitations.module.js';
import { ListsModule } from './modules/lists/lists.module.js';
import { MembersModule } from './modules/members/members.module.js';
import { MeRoutesModule } from './modules/me/me.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { RealtimeTicketsModule } from './modules/realtime-tickets/realtime-tickets.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { SpacesModule } from './modules/spaces/spaces.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { TrashModule } from './modules/trash/trash.module.js';
import { TwoStepVerificationModule } from './modules/two-step-verification/two-step-verification.module.js';

/**
 * Constant ROUTE_MODULES
 *
 * @description
 * The modules of the public routes, in the order they are registered: `AppModule` imports them,
 * and the route tests serve the same list with the internal services faked, so a route module
 * added here is tested as it is served.
 *
 * @type {readonly Type[]}
 */
export const ROUTE_MODULES: readonly Type[] = [
  AuthRoutesModule,
  MeRoutesModule,
  RealtimeTicketsModule,
  SessionsModule,
  TwoStepVerificationModule,
  OrganizationsModule,
  MembersModule,
  InvitationsModule,
  ApiTokensModule,
  SpacesModule,
  ListsModule,
  TasksModule,
  CommentsModule,
  WatchersModule,
  DependenciesModule,
  TaskTemplatesModule,
  SavedViewsModule,
  FavoritesModule,
  AccessModule,
  ArchivesModule,
  TrashModule,
];

/**
 * Constant SHUTDOWN_DELAY_MS
 *
 * @description
 * How long the stop keeps serving with readiness at 503 before it closes the listener, in
 * milliseconds.
 *
 * Traefik routes to the containers Docker reports healthy and learns about them through Docker
 * events, applied at most every 2 seconds (its default provider throttle, which cadenway-ops does
 * not change). During a rolling update the GitOps agent stops the old container as soon as the new
 * one is healthy (it polls every 2 seconds): for up to 2 seconds more Traefik may still route only
 * to the old one. Three seconds keep it answering through that window. Readiness itself does not
 * take the instance out of Traefik: the container healthcheck needs five failed probes ten seconds
 * apart, longer than the 30 seconds the agent gives a stop; Traefik drops the instance when it
 * exits. The delay stays well under the 10 second default grace period of Docker.
 *
 * @type {number}
 */
export const SHUTDOWN_DELAY_MS: number = 3000;

/**
 * Class AppModule
 *
 * @description
 * Root module of the gateway, wrapped by `createApplication` of `@cadenway/nest-common`, which
 * adds the logs, the error format, the validation pipe, the interceptors, the body limit and the
 * request deadline.
 *
 * - `CONFIG` is not provided here: `createGatewayApplication` hands the configuration that
 *   `main.ts` validated once to `createApplication` (`provideConfig: true`), which provides it
 *   globally. Importing this module reads nothing.
 * - Route capabilities import technical clients and bind their own ports.
 * - `ROUTE_MODULES` serve the public routes: `AuthRoutesModule`, `MeRoutesModule`,
 *   `SessionsModule` and `TwoStepVerificationModule` (the routes of `openapi/public/auth.yaml`),
 *   `OrganizationsModule`
 *   (`organizations.yaml`), `MembersModule` and `InvitationsModule` (`members.yaml`),
 *   `ApiTokensModule` (`api-tokens.yaml`), `SpacesModule`, `ListsModule` and `TasksModule`
 *   (`spaces.yaml`, `lists.yaml`, `tasks.yaml`), `AccessModule` (`access.yaml`), `ArchivesModule`
 *   (`archives.yaml`) and `TrashModule` (`trash.yaml`). Each applies the credential guard of `auth` and the
 *   rate limit of `rate-limit`.
 * - `RedisModule` opens the Redis connection of the rate-limit counters.
 * - `HealthModule` serves `GET /health/live`, which checks nothing, and `GET /health/ready`, which
 *   answers 503 while Redis does not answer `PING` within one second, and from the start of the
 *   stop (see `SHUTDOWN_DELAY_MS`). Both are what the container healthcheck and the deployment
 *   probe.
 *
 * The gateway has no broker connection yet: it gets NATS when it publishes its usage event, as
 * cadenway-ops `docs/service-environment.md` lists. Public HTTP capabilities under `src/modules/` register here as they are created.
 */
@Module({
  imports: [
    RedisModule,
    HealthModule.forRootAsync({
      imports: [RedisModule],
      inject: [ResilientRedisClient],
      useFactory: (redis: ResilientRedisClient): HealthModuleOptions => ({
        indicators: [redisIndicator(redis)],
        shutdownDelayMs: SHUTDOWN_DELAY_MS,
      }),
    }),
    ...ROUTE_MODULES,
  ],
})
export class AppModule {}
