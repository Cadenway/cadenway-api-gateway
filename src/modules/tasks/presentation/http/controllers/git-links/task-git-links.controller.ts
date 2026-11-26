import {
  ListTaskGitLinksParams,
  ListTaskGitLinksQueryParams,
  ListTaskGitLinksResponse,
} from '@cadenway/contracts/validators/public/git-links';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListTaskGitLinks } from '../../../../application/use-cases/queries/git-links/list-task-git-links/list-task-git-links.use-case.js';

/**
 * Constant LIST_TASK_GIT_LINKS_PROBLEMS
 *
 * @description
 * Client errors that `GET /v1/tasks/{taskKey}/git-links` answers as they are: those of the task
 * read in task-service, `task.trashed` with its `details`, and the refused cursor of
 * integration-service. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_TASK_GIT_LINKS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};

/**
 * Class TaskGitLinksController
 *
 * @description
 * The route of `openapi/public/git-links.yaml`: the branches and pull or merge requests linked to
 * a task the caller sees, on the current organization. The organization precondition, the cache
 * policy and the rate limit are those of every task route.
 */
@Controller('v1/tasks/:taskKey/git-links')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskGitLinksController {
  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the Git link read.
   *
   * @param {ListTaskGitLinks} listing - Use case `ListTaskGitLinks`.
   * @constructor
   */
  public constructor(@Inject(ListTaskGitLinks) private readonly listing: ListTaskGitLinks) {}
  // #endregion

  // #region Methods
  /**
   * Method list
   *
   * @description
   * `GET /v1/tasks/{taskKey}/git-links`: one page of the task's Git links, newest first, once
   * task-service let the caller read the task.
   *
   * @param {z.output<typeof ListTaskGitLinksParams>} params - The path parameters.
   * @param {z.output<typeof ListTaskGitLinksQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListTaskGitLinksResponse>>} The page, mapped to the public
   * contract.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listTaskGitLinks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Param(new ZodValidationPipe(ListTaskGitLinksParams))
    params: z.output<typeof ListTaskGitLinksParams>,
    @Query(new ZodValidationPipe(ListTaskGitLinksQueryParams.strict()))
    query: z.output<typeof ListTaskGitLinksQueryParams>,
  ): Promise<z.output<typeof ListTaskGitLinksResponse>> {
    return conformBody(
      'integration-service',
      'listTaskGitLinks',
      ListTaskGitLinksResponse,
      await relayProblems(LIST_TASK_GIT_LINKS_PROBLEMS, () =>
        this.listing.execute(params.taskKey, query),
      ),
    );
  }
  // #endregion
}
