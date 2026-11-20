import {
  ListTaskDependenciesParams,
  ListTaskDependenciesQueryParams,
  ListTaskDependenciesResponse,
  CreateTaskDependencyParams,
  CreateTaskDependencyHeader,
  CreateTaskDependencyBody,
  CreateTaskDependencyResponse,
  GetTaskDependencyParams,
  GetTaskDependencyResponse,
  DeleteTaskDependencyParams,
  ListDependencyCandidatesParams,
  ListDependencyCandidatesQueryParams,
  ListDependencyCandidatesResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
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
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListTaskDependencies } from '../../../../application/use-cases/queries/dependencies/list-task-dependencies/list-task-dependencies.use-case.js';
import { CreateTaskDependency } from '../../../../application/use-cases/commands/dependencies/create-task-dependency/create-task-dependency.use-case.js';
import { GetTaskDependency } from '../../../../application/use-cases/queries/dependencies/get-task-dependency/get-task-dependency.use-case.js';
import { DeleteTaskDependency } from '../../../../application/use-cases/commands/dependencies/delete-task-dependency/delete-task-dependency.use-case.js';
import { ListDependencyCandidates } from '../../../../application/use-cases/queries/dependencies/list-dependency-candidates/list-dependency-candidates.use-case.js';

/** Errors of task visibility. */
const TASK_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
/** Errors of dependency visibility. */
const DEPENDENCY_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['dependency.not-found', 'task.not-found', 'task.trashed', 'organization.not-found'],
};
/** Errors of creating an edge. */
const CREATE: AcceptedProblems = {
  ...TASK_READ,
  403: ['access.role-insufficient'],
  409: ['dependency.already-exists', 'task.archived', 'idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: ['dependency.cycle', 'dependency.limit-reached', 'idempotency.key-reused'],
};
/** Errors of removing an edge. */
const REMOVE: AcceptedProblems = {
  ...DEPENDENCY_READ,
  403: ['access.role-insufficient'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};
/** Errors of reading eligible candidates. */
const CANDIDATES: AcceptedProblems = { ...TASK_READ, 403: ['access.role-insufficient'] };

/** Public task dependency routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class DependenciesController {
  // #region Properties
  /** Use case for listTaskDependencies. */
  private readonly listTaskDependenciesUseCase: ListTaskDependencies;

  /** Use case for createTaskDependency. */
  private readonly createTaskDependencyUseCase: CreateTaskDependency;

  /** Use case for getTaskDependency. */
  private readonly getTaskDependencyUseCase: GetTaskDependency;

  /** Use case for deleteTaskDependency. */
  private readonly deleteTaskDependencyUseCase: DeleteTaskDependency;

  /** Use case for listDependencyCandidates. */
  private readonly listDependencyCandidatesUseCase: ListDependencyCandidates;
  // #endregion

  // #region Constructor
  /** Binds the route use cases. */
  public constructor(
    @Inject(ListTaskDependencies) listTaskDependencies: ListTaskDependencies,
    @Inject(CreateTaskDependency) createTaskDependency: CreateTaskDependency,
    @Inject(GetTaskDependency) getTaskDependency: GetTaskDependency,
    @Inject(DeleteTaskDependency) deleteTaskDependency: DeleteTaskDependency,
    @Inject(ListDependencyCandidates) listDependencyCandidates: ListDependencyCandidates,
  ) {
    this.listTaskDependenciesUseCase = listTaskDependencies;
    this.createTaskDependencyUseCase = createTaskDependency;
    this.getTaskDependencyUseCase = getTaskDependency;
    this.deleteTaskDependencyUseCase = deleteTaskDependency;
    this.listDependencyCandidatesUseCase = listDependencyCandidates;
  }
  // #endregion

  // #region Methods
  /** Lists the task dependencies. */
  @Get('tasks/:taskKey/dependencies')
  @CredentialGuard.requires({
    operationId: 'listTaskDependencies',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listTaskDependencies(
    @Param(new ZodValidationPipe(ListTaskDependenciesParams))
    params: z.output<typeof ListTaskDependenciesParams>,
    @Query(new ZodValidationPipe(ListTaskDependenciesQueryParams))
    query: z.output<typeof ListTaskDependenciesQueryParams>,
  ): Promise<z.output<typeof ListTaskDependenciesResponse>> {
    return conformBody(
      'task-service',
      'listTaskDependencies',
      ListTaskDependenciesResponse,
      await relayProblems(TASK_READ, () =>
        this.listTaskDependenciesUseCase.execute(params.taskKey, query),
      ),
    );
  }

  /** Creates an edge and returns its public location and anchor version. */
  @Post('tasks/:taskKey/dependencies')
  @CredentialGuard.requires({
    operationId: 'createTaskDependency',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createTaskDependency(
    @Param(new ZodValidationPipe(CreateTaskDependencyParams))
    params: z.output<typeof CreateTaskDependencyParams>,
    @RequiredBody(CreateTaskDependencyBody) body: z.output<typeof CreateTaskDependencyBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateTaskDependencyResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateTaskDependencyHeader.shape['Idempotency-Key'],
      key,
    );
    const created = await relayProblems(CREATE, () =>
      this.createTaskDependencyUseCase.execute(params.taskKey, body, ifMatch, idempotencyKey),
    );
    const dependency = conformBody(
      'task-service',
      'createTaskDependency',
      CreateTaskDependencyResponse,
      created.dependency,
    );
    const anchor = [dependency.blocker.key, dependency.blocked.key].find(
      (key) => key === params.taskKey,
    );
    if (anchor === undefined) {
      throw outsideContract(
        'task-service',
        'createTaskDependency',
        'a dependency outside the anchor task',
      );
    }
    response.setHeader('ETag', formatEtag(created.version));
    response.setHeader('Location', `/v1/tasks/${anchor}/dependencies/${dependency.id}`);
    return dependency;
  }

  /** Reads a visible dependency. */
  @Get('tasks/:taskKey/dependencies/:dependencyId')
  @CredentialGuard.requires({
    operationId: 'getTaskDependency',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getTaskDependency(
    @Param(new ZodValidationPipe(GetTaskDependencyParams))
    params: z.output<typeof GetTaskDependencyParams>,
  ): Promise<z.output<typeof GetTaskDependencyResponse>> {
    return conformBody(
      'task-service',
      'getTaskDependency',
      GetTaskDependencyResponse,
      await relayProblems(DEPENDENCY_READ, () =>
        this.getTaskDependencyUseCase.execute(params.taskKey, params.dependencyId),
      ),
    );
  }

  /** Deletes an edge and returns the anchor version. */
  @Delete('tasks/:taskKey/dependencies/:dependencyId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteTaskDependency',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async deleteTaskDependency(
    @Param(new ZodValidationPipe(DeleteTaskDependencyParams))
    params: z.output<typeof DeleteTaskDependencyParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const version = await relayProblems(REMOVE, () =>
      this.deleteTaskDependencyUseCase.execute(params.taskKey, params.dependencyId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(version));
  }

  /** Lists eligible dependency candidates. */
  @Get('tasks/:taskKey/dependency-candidates')
  @CredentialGuard.requires({
    operationId: 'listDependencyCandidates',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listDependencyCandidates(
    @Param(new ZodValidationPipe(ListDependencyCandidatesParams))
    params: z.output<typeof ListDependencyCandidatesParams>,
    @Query(new ZodValidationPipe(ListDependencyCandidatesQueryParams))
    query: z.output<typeof ListDependencyCandidatesQueryParams>,
  ): Promise<z.output<typeof ListDependencyCandidatesResponse>> {
    return conformBody(
      'task-service',
      'listDependencyCandidates',
      ListDependencyCandidatesResponse,
      await relayProblems(CANDIDATES, () =>
        this.listDependencyCandidatesUseCase.execute(params.taskKey, query),
      ),
    );
  }
  // #endregion
}
