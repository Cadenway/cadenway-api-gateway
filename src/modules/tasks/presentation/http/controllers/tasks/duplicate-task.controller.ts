import {
  DuplicateTaskBody,
  DuplicateTaskHeader,
  DuplicateTaskParams,
  DuplicateTaskResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Headers, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { DuplicateTask } from '../../../../application/use-cases/commands/tasks/duplicate-task/duplicate-task.use-case.js';

/** Client errors declared for this duplicate operation. */
const PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: [
    'task.subtask-limit-reached',
    'task.subtask-depth-exceeded',
    'task.status-hidden',
    'task.cancel-reason-required',
    'idempotency.key-reused',
  ],
};

/** Public task duplication route. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class DuplicateTaskController {
  // #region Properties
  /** The duplication use case. */
  private readonly duplicate: DuplicateTask;
  // #endregion
  // #region Constructor
  /** Binds the use case. */
  public constructor(@Inject(DuplicateTask) duplicate: DuplicateTask) {
    this.duplicate = duplicate;
  }
  // #endregion
  // #region Methods
  /** Duplicates the resource once with the caller's headers. */
  @Post('tasks/:taskKey/duplicate')
  @CredentialGuard.requires({
    operationId: 'duplicateTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async duplicateTask(
    @Param(new ZodValidationPipe(DuplicateTaskParams)) params: z.output<typeof DuplicateTaskParams>,
    @RequiredBody(DuplicateTaskBody) body: z.output<typeof DuplicateTaskBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof DuplicateTaskResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      DuplicateTaskHeader.shape['Idempotency-Key'],
      key,
    );
    const result = conformBody(
      'task-service',
      'duplicateTask',
      DuplicateTaskResponse,
      await relayProblems(PROBLEMS, () =>
        this.duplicate.execute(params.taskKey, body, ifMatch, idempotencyKey),
      ),
    );
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/tasks/${result.key}`);
    return result;
  }
  // #endregion
}
