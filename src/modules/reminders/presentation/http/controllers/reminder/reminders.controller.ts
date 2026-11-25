import {
  CompleteReminderParams,
  CompleteReminderResponse,
  DeleteReminderParams,
  GetReminderParams,
  GetReminderResponse,
  GetTaskReminderParams,
  GetTaskReminderResponse,
  ListRemindersQueryParams,
  ListRemindersResponse,
  SetTaskReminderBody,
  SetTaskReminderParams,
  SetTaskReminderResponse,
  SnoozeReminderBody,
  SnoozeReminderParams,
  SnoozeReminderResponse,
  UpdateReminderNoteBody,
  UpdateReminderNoteParams,
  UpdateReminderNoteResponse,
} from '@cadenway/contracts/validators/public/reminders';
import {
  formatEtag,
  getOrganizationContext,
  ProblemException,
  remainingBudgetMs,
  ZodValidationPipe,
} from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { verifiedCredentialOf } from '../../../../../../presentation/http/session/request-session.js';
import { publicProblem } from '../../../../../../problems/public-problem.js';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { InvalidReminderCursor } from '../../../../application/models/reminder/invalid-reminder-cursor.model.js';
import { ReminderListUnavailable } from '../../../../application/models/reminder/reminder-list-unavailable.model.js';
import { AccessReminder } from '../../../../application/use-cases/queries/reminder/access-reminder/access-reminder.use-case.js';
import { ReminderTargetNotFound } from '../../../../application/models/reminder/reminder-target-not-found.model.js';
import { ListReminders } from '../../../../application/use-cases/queries/reminder/list-reminders/list-reminders.use-case.js';

const ACCEPTED: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'reminder.not-found', 'organization.not-found'],
  409: ['reminder.already-completed'],
  412: ['request.version-mismatch'],
  422: ['reminder.date-not-in-future'],
};

/** Session-only personal reminder routes in the selected organization. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class RemindersController {
  // #region Constructor
  /** Binds the public reminder operations. */
  public constructor(
    @Inject(ListReminders) private readonly listReminders: ListReminders,
    @Inject(AccessReminder) private readonly access: AccessReminder,
  ) {}
  // #endregion

  // #region Methods
  /** Lists accessible pending reminders. */
  @Get('reminders')
  @CredentialGuard.requires({
    operationId: 'listReminders',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Query(new ZodValidationPipe(ListRemindersQueryParams))
    query: z.output<typeof ListRemindersQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof ListRemindersResponse>> {
    const organizationId = getOrganizationContext()?.organizationId;
    const userId = verifiedCredentialOf(request)?.userId;
    if (!organizationId || !userId)
      throw new Error('The reminder route requires a verified organization and user.');
    const page = await this.relay(undefined, () =>
      this.listReminders.execute({ organizationId, userId, ...query }, remainingBudgetMs()),
    );
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    return conformBody('notification-service', 'listReminders', ListRemindersResponse, {
      ...page,
      items: [...page.items],
    });
  }

  /** Reads a task reminder in the verified organization. */
  @Get('tasks/:taskKey/reminder')
  @Header('Cache-Control', 'private, no-store')
  @CredentialGuard.requires({
    operationId: 'getTaskReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getTask(
    @Param(new ZodValidationPipe(GetTaskReminderParams))
    params: z.output<typeof GetTaskReminderParams>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskReminderResponse>> {
    return this.versioned(response, request, GetTaskReminderResponse, 'getTaskReminder', () =>
      this.access.execute('getTask', params.taskKey),
    );
  }

  @Put('tasks/:taskKey/reminder')
  @CredentialGuard.requires({
    operationId: 'setTaskReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async setTask(
    @Param(new ZodValidationPipe(SetTaskReminderParams))
    params: z.output<typeof SetTaskReminderParams>,
    @RequiredBody(SetTaskReminderBody) body: z.output<typeof SetTaskReminderBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SetTaskReminderResponse>> {
    const result = await this.relay(response, () =>
      this.access.execute('setTask', params.taskKey, body, ifMatch),
    );
    const reminder = conformBody(
      'notification-service',
      'setTaskReminder',
      SetTaskReminderResponse,
      result.reminder,
    );
    response.setHeader('ETag', formatEtag(reminder.version));
    if (result.created) {
      response.status(201);
      response.setHeader('Location', `/v1/reminders/${reminder.id}`);
    } else response.status(200);
    return reminder;
  }

  @Get('reminders/:reminderId')
  @CredentialGuard.requires({
    operationId: 'getReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetReminderParams)) params: z.output<typeof GetReminderParams>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetReminderResponse>> {
    return this.versioned(response, request, GetReminderResponse, 'getReminder', () =>
      this.access.execute('get', params.reminderId.toLowerCase()),
    );
  }

  @Patch('reminders/:reminderId')
  @CredentialGuard.requires({
    operationId: 'updateReminderNote',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async update(
    @Param(new ZodValidationPipe(UpdateReminderNoteParams))
    params: z.output<typeof UpdateReminderNoteParams>,
    @RequiredBody(UpdateReminderNoteBody) body: z.output<typeof UpdateReminderNoteBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateReminderNoteResponse>> {
    return this.versioned(
      response,
      undefined,
      UpdateReminderNoteResponse,
      'updateReminderNote',
      () => this.access.execute('update', params.reminderId.toLowerCase(), body, ifMatch),
    );
  }

  @Delete('reminders/:reminderId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async remove(
    @Param(new ZodValidationPipe(DeleteReminderParams))
    params: z.output<typeof DeleteReminderParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.relay(response, () =>
      this.access.execute('remove', params.reminderId.toLowerCase(), undefined, ifMatch),
    );
  }

  @Post('reminders/:reminderId/snooze')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'snoozeReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async snooze(
    @Param(new ZodValidationPipe(SnoozeReminderParams))
    params: z.output<typeof SnoozeReminderParams>,
    @RequiredBody(SnoozeReminderBody) body: z.output<typeof SnoozeReminderBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SnoozeReminderResponse>> {
    return this.versioned(response, undefined, SnoozeReminderResponse, 'snoozeReminder', () =>
      this.access.execute('snooze', params.reminderId.toLowerCase(), body, ifMatch),
    );
  }

  @Post('reminders/:reminderId/complete')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'completeReminder',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
    allowBodylessPost: true,
  })
  public async complete(
    @Param(new ZodValidationPipe(CompleteReminderParams))
    params: z.output<typeof CompleteReminderParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CompleteReminderResponse>> {
    return this.versioned(response, undefined, CompleteReminderResponse, 'completeReminder', () =>
      this.access.execute('complete', params.reminderId.toLowerCase(), undefined, ifMatch),
    );
  }

  private async versioned<T extends { version: number }>(
    response: Response,
    request: Request | undefined,
    schema: z.ZodType<T>,
    operation: string,
    call: () => Promise<T>,
  ): Promise<T> {
    const result = conformBody(
      'notification-service',
      operation,
      schema,
      await this.relay(response, call),
    );
    response.setHeader('ETag', formatEtag(result.version));
    if (request) {
      delete request.headers['if-none-match'];
      delete request.headers['if-modified-since'];
    }
    return result;
  }

  private async relay<T>(response: Response | undefined, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof ReminderTargetNotFound)
        throw publicProblem({
          status: 404,
          code: error.code,
          detail: 'The requested resource was not found.',
        });
      if (error instanceof InvalidReminderCursor)
        throw publicProblem({
          status: 400,
          code: 'request.invalid',
          detail: 'Invalid reminder cursor.',
        });
      if (error instanceof ReminderListUnavailable)
        throw publicProblem({
          status: 503,
          code: error.code,
          detail: 'The reminder list is unavailable.',
          details: { service: error.service },
        });
      const translated = toPublicProblem(error, ACCEPTED);
      if (translated instanceof ProblemException && translated.problem.status === 412) {
        const version = translated.problem.details?.version;
        if (response && typeof version === 'number' && Number.isSafeInteger(version) && version > 0)
          response.setHeader('ETag', formatEtag(version));
      }
      throw translated;
    }
  }
  // #endregion
}
