import {
  CreateTaskTimeEntryBody,
  CreateTaskTimeEntryHeader,
  CreateTaskTimeEntryParams,
  CreateTaskTimeEntryResponse,
  DeleteTaskTimeEntryParams,
  GetTaskStatusDurationsParams,
  GetTaskStatusDurationsResponse,
  GetTaskTimeEntryParams,
  GetTaskTimeEntryResponse,
  GetTaskTimeSummaryParams,
  GetTaskTimeSummaryResponse,
  ListTaskTimeEntriesParams,
  ListTaskTimeEntriesQueryParams,
  ListTaskTimeEntriesResponse,
} from '@cadenway/contracts/validators/public/time';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateTaskTimeEntry } from '../../../../application/use-cases/commands/time/create-task-time-entry/create-task-time-entry.use-case.js';
import { DeleteTaskTimeEntry } from '../../../../application/use-cases/commands/time/delete-task-time-entry/delete-task-time-entry.use-case.js';
import { ListTaskTimeEntries } from '../../../../application/use-cases/queries/time/list-task-time-entries/list-task-time-entries.use-case.js';
import { GetTaskTimeEntry } from '../../../../application/use-cases/queries/time/get-task-time-entry/get-task-time-entry.use-case.js';
import { GetTaskTimeSummary } from '../../../../application/use-cases/queries/time/get-task-time-summary/get-task-time-summary.use-case.js';
import { GetTaskStatusDurations } from '../../../../application/use-cases/queries/time/get-task-status-durations/get-task-status-durations.use-case.js';

/** Errors for reading a visible task. */
const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
/** Errors for reading a particular entry. */
const ENTRY: AcceptedProblems = {
  ...READ,
  404: ['task.not-found', 'task.trashed', 'organization.not-found', 'time-entry.not-found'],
};
/** Errors for creating an entry. */
const CREATE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};
/** Errors for removing an entry. */
const REMOVE: AcceptedProblems = {
  ...ENTRY,
  403: ['access.role-insufficient', 'time-entry.author-required'],
  409: ['task.archived'],
};

/** Public task time and status duration routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskTimeController {
  // #region Constructor
  /** Binds the task time use case. */
  public constructor(
    @Inject(ListTaskTimeEntries) private readonly listEntries: ListTaskTimeEntries,
    @Inject(CreateTaskTimeEntry) private readonly createEntry: CreateTaskTimeEntry,
    @Inject(GetTaskTimeEntry) private readonly getEntry: GetTaskTimeEntry,
    @Inject(DeleteTaskTimeEntry) private readonly deleteEntry: DeleteTaskTimeEntry,
    @Inject(GetTaskTimeSummary) private readonly getSummary: GetTaskTimeSummary,
    @Inject(GetTaskStatusDurations) private readonly getDurations: GetTaskStatusDurations,
  ) {}
  // #endregion

  // #region Methods
  /** Lists the entries and task-wide totals. */
  @Get('tasks/:taskKey/time-entries')
  @CredentialGuard.requires({
    operationId: 'listTaskTimeEntries',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Param(new ZodValidationPipe(ListTaskTimeEntriesParams))
    params: z.output<typeof ListTaskTimeEntriesParams>,
    @Query(new ZodValidationPipe(ListTaskTimeEntriesQueryParams))
    query: z.output<typeof ListTaskTimeEntriesQueryParams>,
  ): Promise<z.output<typeof ListTaskTimeEntriesResponse>> {
    return conformBody(
      'task-service',
      'listTaskTimeEntries',
      ListTaskTimeEntriesResponse,
      await relayProblems(READ, () => this.listEntries.execute(params.taskKey, query)),
    );
  }

  /** Creates a time entry and returns its public location. */
  @Post('tasks/:taskKey/time-entries')
  @CredentialGuard.requires({
    operationId: 'createTaskTimeEntry',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async create(
    @Param(new ZodValidationPipe(CreateTaskTimeEntryParams))
    params: z.output<typeof CreateTaskTimeEntryParams>,
    @RequiredBody(CreateTaskTimeEntryBody) body: z.output<typeof CreateTaskTimeEntryBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateTaskTimeEntryResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateTaskTimeEntryHeader.shape['Idempotency-Key'],
      key,
    );
    const entry = conformBody(
      'task-service',
      'createTaskTimeEntry',
      CreateTaskTimeEntryResponse,
      await relayProblems(CREATE, () =>
        this.createEntry.execute(params.taskKey, body, idempotencyKey),
      ),
    );
    if (entry.taskKey !== params.taskKey) {
      throw outsideContract('task-service', 'createTaskTimeEntry', 'an entry outside the task');
    }
    response.setHeader('Location', `/v1/tasks/${params.taskKey}/time-entries/${entry.id}`);
    return entry;
  }

  /** Reads an entry from the visible task. */
  @Get('tasks/:taskKey/time-entries/:timeEntryId')
  @CredentialGuard.requires({
    operationId: 'getTaskTimeEntry',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetTaskTimeEntryParams))
    params: z.output<typeof GetTaskTimeEntryParams>,
  ): Promise<z.output<typeof GetTaskTimeEntryResponse>> {
    return conformBody(
      'task-service',
      'getTaskTimeEntry',
      GetTaskTimeEntryResponse,
      await relayProblems(ENTRY, () => this.getEntry.execute(params.taskKey, params.timeEntryId)),
    );
  }

  /** Removes an entry from the visible task. */
  @Delete('tasks/:taskKey/time-entries/:timeEntryId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteTaskTimeEntry',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async remove(
    @Param(new ZodValidationPipe(DeleteTaskTimeEntryParams))
    params: z.output<typeof DeleteTaskTimeEntryParams>,
  ): Promise<void> {
    await relayProblems(REMOVE, () => this.deleteEntry.execute(params.taskKey, params.timeEntryId));
  }

  /** Reads the total minutes and estimate. */
  @Get('tasks/:taskKey/time-summary')
  @CredentialGuard.requires({
    operationId: 'getTaskTimeSummary',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async summary(
    @Param(new ZodValidationPipe(GetTaskTimeSummaryParams))
    params: z.output<typeof GetTaskTimeSummaryParams>,
  ): Promise<z.output<typeof GetTaskTimeSummaryResponse>> {
    return conformBody(
      'task-service',
      'getTaskTimeSummary',
      GetTaskTimeSummaryResponse,
      await relayProblems(READ, () => this.getSummary.execute(params.taskKey)),
    );
  }

  /** Reads durations from the recorded status history. */
  @Get('tasks/:taskKey/status-durations')
  @CredentialGuard.requires({
    operationId: 'getTaskStatusDurations',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async durations(
    @Param(new ZodValidationPipe(GetTaskStatusDurationsParams))
    params: z.output<typeof GetTaskStatusDurationsParams>,
  ): Promise<z.output<typeof GetTaskStatusDurationsResponse>> {
    return conformBody(
      'task-service',
      'getTaskStatusDurations',
      GetTaskStatusDurationsResponse,
      await relayProblems(READ, () => this.getDurations.execute(params.taskKey)),
    );
  }
  // #endregion
}
