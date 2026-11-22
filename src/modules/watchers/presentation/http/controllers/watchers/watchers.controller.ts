import {
  FollowTaskWatcherBody,
  FollowTaskWatcherParams,
  FollowTaskWatcherResponse,
  ListTaskWatchersParams,
  ListTaskWatchersQueryParams,
  ListTaskWatchersResponse,
  UnfollowTaskWatcherParams,
} from '@cadenway/contracts/validators/public/tasks';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListTaskWatchers } from '../../../../application/use-cases/queries/watchers/list-task-watchers/list-task-watchers.use-case.js';
import { FollowTaskWatcher } from '../../../../application/use-cases/commands/watchers/follow-task-watcher/follow-task-watcher.use-case.js';
import { UnfollowTaskWatcher } from '../../../../application/use-cases/commands/watchers/unfollow-task-watcher/unfollow-task-watcher.use-case.js';

/** Public errors of a watcher list. */
const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
/** Public errors of watcher changes. */
const CHANGE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
  422: ['watcher.recipient-invalid', 'watcher.limit-reached'],
};

/** Public watcher routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class WatchersController {
  // #region Properties
  /** Lists task watchers. */
  private readonly listing: ListTaskWatchers;

  /** Follows a task. */
  private readonly follow: FollowTaskWatcher;

  /** Unfollows a task. */
  private readonly unfollow: UnfollowTaskWatcher;
  // #endregion

  // #region Constructor
  /** Binds the use cases. */
  public constructor(
    @Inject(ListTaskWatchers) listing: ListTaskWatchers,
    @Inject(FollowTaskWatcher) follow: FollowTaskWatcher,
    @Inject(UnfollowTaskWatcher) unfollow: UnfollowTaskWatcher,
  ) {
    this.listing = listing;
    this.follow = follow;
    this.unfollow = unfollow;
  }
  // #endregion

  // #region Methods
  /** Lists the effective watchers. */
  @Get('tasks/:taskKey/watchers')
  @CredentialGuard.requires({
    operationId: 'listTaskWatchers',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listTaskWatchers(
    @Param(new ZodValidationPipe(ListTaskWatchersParams))
    params: z.output<typeof ListTaskWatchersParams>,
    @Query(new ZodValidationPipe(ListTaskWatchersQueryParams))
    query: z.output<typeof ListTaskWatchersQueryParams>,
  ): Promise<z.output<typeof ListTaskWatchersResponse>> {
    return conformBody(
      'task-service',
      'listTaskWatchers',
      ListTaskWatchersResponse,
      await relayProblems(READ, () => this.listing.execute(params.taskKey, query)),
    );
  }

  /** Follows a task and returns the task version. */
  @Put('tasks/:taskKey/watchers/:userId')
  @CredentialGuard.requires({
    operationId: 'followTaskWatcher',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async followTaskWatcher(
    @Param(new ZodValidationPipe(FollowTaskWatcherParams))
    params: z.output<typeof FollowTaskWatcherParams>,
    @RequiredBody(FollowTaskWatcherBody) body: z.output<typeof FollowTaskWatcherBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof FollowTaskWatcherResponse>> {
    const result = await relayProblems(CHANGE, () =>
      this.follow.execute(params.taskKey, params.userId, body, ifMatch),
    );
    const watcher = conformBody(
      'task-service',
      'followTaskWatcher',
      FollowTaskWatcherResponse,
      result.watcher,
    );
    response.setHeader('ETag', formatEtag(result.version));
    return watcher;
  }

  /** Unfollows a task and returns the task version. */
  @Delete('tasks/:taskKey/watchers/:userId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'unfollowTaskWatcher',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async unfollowTaskWatcher(
    @Param(new ZodValidationPipe(UnfollowTaskWatcherParams))
    params: z.output<typeof UnfollowTaskWatcherParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const version = await relayProblems(CHANGE, () =>
      this.unfollow.execute(params.taskKey, params.userId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(version));
  }
  // #endregion
}
