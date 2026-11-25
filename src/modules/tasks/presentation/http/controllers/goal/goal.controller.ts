import {
  CreateGoalBody,
  CreateGoalHeader,
  CreateGoalQueryParams,
  CreateGoalResponse,
  CreateGoalResultBody,
  CreateGoalResultHeader,
  CreateGoalResultParams,
  CreateGoalResultResponse,
  DeleteGoalParams,
  DeleteGoalResultParams,
  GetGoalParams,
  GetGoalQueryParams,
  GetGoalResponse,
  GetGoalResultParams,
  GetGoalResultResponse,
  ListGoalsQueryParams,
  ListGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalQueryParams,
  UpdateGoalResponse,
  UpdateGoalResultBody,
  UpdateGoalResultParams,
  UpdateGoalResultResponse,
} from '@cadenway/contracts/validators/public/goals';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
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
import {
  toIfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListGoals } from '../../../../application/use-cases/queries/goal/list-goals/list-goals.use-case.js';
import { CreateGoal } from '../../../../application/use-cases/commands/goal/create-goal/create-goal.use-case.js';
import { GetGoal } from '../../../../application/use-cases/queries/goal/get-goal/get-goal.use-case.js';
import { UpdateGoal } from '../../../../application/use-cases/commands/goal/update-goal/update-goal.use-case.js';
import { DeleteGoal } from '../../../../application/use-cases/commands/goal/delete-goal/delete-goal.use-case.js';
import { CreateGoalResult } from '../../../../application/use-cases/commands/goal/create-goal-result/create-goal-result.use-case.js';
import { GetGoalResult } from '../../../../application/use-cases/queries/goal/get-goal-result/get-goal-result.use-case.js';
import { UpdateGoalResult } from '../../../../application/use-cases/commands/goal/update-goal-result/update-goal-result.use-case.js';
import { DeleteGoalResult } from '../../../../application/use-cases/commands/goal/delete-goal-result/delete-goal-result.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found', 'goal.not-found'],
};
const RESULT_READ: AcceptedProblems = {
  ...READ,
  404: ['organization.not-found', 'goal.not-found', 'goal.result-not-found'],
};
const WRITE: AcceptedProblems = {
  ...READ,
  403: ['organization.role-forbidden', 'access.role-insufficient'],
  412: ['request.version-mismatch'],
};
const RESULT_WRITE: AcceptedProblems = {
  ...WRITE,
  404: ['organization.not-found', 'goal.not-found', 'goal.result-not-found'],
};

/** Routes for goals and their key results. */
@Controller('v1/goals')
@UseGuards(CredentialGuard, RateLimitGuard)
export class GoalController {
  // #region Constructor
  /** Binds the goal operations. */
  public constructor(
    @Inject(ListGoals) private readonly listing: ListGoals,
    @Inject(CreateGoal) private readonly creation: CreateGoal,
    @Inject(GetGoal) private readonly reading: GetGoal,
    @Inject(UpdateGoal) private readonly updating: UpdateGoal,
    @Inject(DeleteGoal) private readonly deletion: DeleteGoal,
    @Inject(CreateGoalResult) private readonly resultCreation: CreateGoalResult,
    @Inject(GetGoalResult) private readonly resultReading: GetGoalResult,
    @Inject(UpdateGoalResult) private readonly resultUpdating: UpdateGoalResult,
    @Inject(DeleteGoalResult) private readonly resultDeletion: DeleteGoalResult,
  ) {}
  // #endregion

  // #region Methods
  /** Lists the readable goals. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listGoals',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Query(new ZodValidationPipe(ListGoalsQueryParams))
    query: z.output<typeof ListGoalsQueryParams>,
  ): Promise<z.output<typeof ListGoalsResponse>> {
    const result = await relayProblems(
      { 400: ['request.invalid'], 404: ['organization.not-found'] },
      () => this.listing.execute(query),
    );
    return conformBody('task-service', 'listGoals', ListGoalsResponse, result);
  }

  /** Creates a goal. */
  @Post()
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'createGoal',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async create(
    @Query(new ZodValidationPipe(CreateGoalQueryParams))
    query: z.output<typeof CreateGoalQueryParams>,
    @RequiredBody(CreateGoalBody) input: z.output<typeof CreateGoalBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateGoalResponse>> {
    const requestKey = toRequestHeader(
      'Idempotency-Key',
      CreateGoalHeader.shape['Idempotency-Key'],
      key,
    );
    const result = await relayProblems(
      {
        400: ['request.invalid'],
        403: ['organization.role-forbidden', 'access.role-insufficient'],
        404: ['organization.not-found', 'space.not-found'],
        409: ['idempotency.request-in-progress'],
        422: [
          'goal.owner-ineligible',
          'goal.due-date-outside-quarter',
          'goal.result-target-invalid',
          'idempotency.key-reused',
        ],
      },
      () => this.creation.execute(query.today, input, requestKey),
    );
    const body = conformBody('task-service', 'createGoal', CreateGoalResponse, result.body);
    if (body.version !== result.version)
      throw outsideContract('task-service', 'createGoal', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/goals/${body.id}?today=${query.today}`);
    return body;
  }

  /** Reads a goal. */
  @Get(':goalId')
  @CredentialGuard.requires({
    operationId: 'getGoal',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetGoalParams)) params: z.output<typeof GetGoalParams>,
    @Query(new ZodValidationPipe(GetGoalQueryParams)) query: z.output<typeof GetGoalQueryParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetGoalResponse>> {
    const result = await relayProblems(READ, () =>
      this.reading.execute(params.goalId, query.today),
    );
    const body = conformBody('task-service', 'getGoal', GetGoalResponse, result.body);
    if (body.id.toLowerCase() !== params.goalId.toLowerCase() || body.version !== result.version)
      throw outsideContract('task-service', 'getGoal', 'an inconsistent goal or ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Updates a goal. */
  @Patch(':goalId')
  @CredentialGuard.requires({
    operationId: 'updateGoal',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async update(
    @Param(new ZodValidationPipe(UpdateGoalParams)) params: z.output<typeof UpdateGoalParams>,
    @Query(new ZodValidationPipe(UpdateGoalQueryParams))
    query: z.output<typeof UpdateGoalQueryParams>,
    @RequiredBody(UpdateGoalBody) input: z.output<typeof UpdateGoalBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateGoalResponse>> {
    const version = toIfMatchHeader(header);
    const result = await relayProblems(
      { ...WRITE, 422: ['goal.owner-ineligible', 'goal.due-date-outside-quarter'] },
      () => this.updating.execute(params.goalId, query.today, input, version),
    );
    const body = conformBody('task-service', 'updateGoal', UpdateGoalResponse, result.body);
    if (body.id.toLowerCase() !== params.goalId.toLowerCase() || body.version !== result.version)
      throw outsideContract('task-service', 'updateGoal', 'an inconsistent goal or ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Deletes a goal. */
  @Delete(':goalId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteGoal',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async delete(
    @Param(new ZodValidationPipe(DeleteGoalParams)) params: z.output<typeof DeleteGoalParams>,
    @Headers('if-match') header: string | undefined,
  ): Promise<void> {
    const version = toIfMatchHeader(header);
    await relayProblems(WRITE, () => this.deletion.execute(params.goalId, version));
  }

  /** Adds a key result. */
  @Post(':goalId/results')
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'createGoalResult',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async createResult(
    @Param(new ZodValidationPipe(CreateGoalResultParams))
    params: z.output<typeof CreateGoalResultParams>,
    @RequiredBody(CreateGoalResultBody) input: z.output<typeof CreateGoalResultBody>,
    @Headers('if-match') header: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateGoalResultResponse>> {
    const version = toIfMatchHeader(header);
    const requestKey = toRequestHeader(
      'Idempotency-Key',
      CreateGoalResultHeader.shape['Idempotency-Key'],
      key,
    );
    const result = await relayProblems(
      {
        ...WRITE,
        409: ['idempotency.request-in-progress'],
        422: ['goal.result-target-invalid', 'goal.result-limit-reached', 'idempotency.key-reused'],
      },
      () => this.resultCreation.execute(params.goalId, input, version, requestKey),
    );
    const body = conformBody(
      'task-service',
      'createGoalResult',
      CreateGoalResultResponse,
      result.body,
    );
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/goals/${params.goalId}/results/${body.id}`);
    return body;
  }

  /** Reads a key result. */
  @Get(':goalId/results/:resultId')
  @CredentialGuard.requires({
    operationId: 'getGoalResult',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getResult(
    @Param(new ZodValidationPipe(GetGoalResultParams)) params: z.output<typeof GetGoalResultParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetGoalResultResponse>> {
    const result = await relayProblems(RESULT_READ, () =>
      this.resultReading.execute(params.goalId, params.resultId),
    );
    const body = conformBody('task-service', 'getGoalResult', GetGoalResultResponse, result.body);
    if (body.id.toLowerCase() !== params.resultId.toLowerCase())
      throw outsideContract('task-service', 'getGoalResult', 'an inconsistent result');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Updates a key result. */
  @Patch(':goalId/results/:resultId')
  @CredentialGuard.requires({
    operationId: 'updateGoalResult',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateResult(
    @Param(new ZodValidationPipe(UpdateGoalResultParams))
    params: z.output<typeof UpdateGoalResultParams>,
    @RequiredBody(UpdateGoalResultBody) input: z.output<typeof UpdateGoalResultBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateGoalResultResponse>> {
    const version = toIfMatchHeader(header);
    const result = await relayProblems(
      { ...RESULT_WRITE, 422: ['goal.result-patch-invalid'] },
      () => this.resultUpdating.execute(params.goalId, params.resultId, input, version),
    );
    const body = conformBody(
      'task-service',
      'updateGoalResult',
      UpdateGoalResultResponse,
      result.body,
    );
    if (body.id.toLowerCase() !== params.resultId.toLowerCase())
      throw outsideContract('task-service', 'updateGoalResult', 'an inconsistent result');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Deletes a key result. */
  @Delete(':goalId/results/:resultId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteGoalResult',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async deleteResult(
    @Param(new ZodValidationPipe(DeleteGoalResultParams))
    params: z.output<typeof DeleteGoalResultParams>,
    @Headers('if-match') header: string | undefined,
  ): Promise<void> {
    const version = toIfMatchHeader(header);
    await relayProblems(RESULT_WRITE, () =>
      this.resultDeletion.execute(params.goalId, params.resultId, version),
    );
  }
  // #endregion
}
