import {
  ExecuteBulkTaskActionBody,
  ExecuteBulkTaskActionHeader,
  ExecuteBulkTaskActionResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { Controller, Headers, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ExecuteBulkTaskAction } from '../../../../application/use-cases/commands/tasks/execute-bulk-task-action/execute-bulk-task-action.use-case.js';

/** Errors declared by the public bulk action. */
const PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'list.not-found', 'organization.not-found'],
  409: ['task.archived', 'recurrence.already-spawned', 'idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: [
    'bulk.expansion-limit-reached',
    'idempotency.key-reused',
    'task.status-hidden',
    'task.cancel-reason-required',
    'task.cancel-reason-unexpected',
    'task.assignee-invalid',
    'task.assignee-limit-reached',
    'task.subtask-limit-reached',
    'task.subtask-depth-exceeded',
    'task.start-date-invalid',
    'milestone.status-invalid',
    'milestone.dates-invalid',
    'recurrence.date-out-of-range',
  ],
};

/** Public atomic bulk task action. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ExecuteBulkTaskActionController {
  // #region Properties
  /** Bulk action use case. */
  private readonly action: ExecuteBulkTaskAction;
  // #endregion
  // #region Constructor
  /** Binds the use case. */
  public constructor(@Inject(ExecuteBulkTaskAction) action: ExecuteBulkTaskAction) {
    this.action = action;
  }
  // #endregion
  // #region Methods
  /** Relays the validated action once with its idempotency key. */
  @Post('tasks/bulk-actions')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'executeBulkTaskAction',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async executeBulkTaskAction(
    @RequiredBody(ExecuteBulkTaskActionBody) body: z.output<typeof ExecuteBulkTaskActionBody>,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<z.output<typeof ExecuteBulkTaskActionResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      ExecuteBulkTaskActionHeader.shape['Idempotency-Key'],
      key,
    );
    return conformBody(
      'task-service',
      'executeBulkTaskAction',
      ExecuteBulkTaskActionResponse,
      await relayProblems(PROBLEMS, () => this.action.execute(body, idempotencyKey), [404]),
    );
  }
  // #endregion
}
