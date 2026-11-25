import {
  ListTaskTemplatesParams,
  ListTaskTemplatesQueryParams,
  ListTaskTemplatesResponse,
  CreateTaskTemplateParams,
  CreateTaskTemplateHeader,
  CreateTaskTemplateBody,
  CreateTaskTemplateResponse,
  GetTaskTemplateParams,
  GetTaskTemplateResponse,
  DeleteTaskTemplateParams,
} from '@cadenway/contracts/validators/public/spaces';
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
import { ListTaskTemplates } from '../../../../application/use-cases/queries/templates/list-task-templates/list-task-templates.use-case.js';
import { CreateTaskTemplate } from '../../../../application/use-cases/commands/templates/create-task-template/create-task-template.use-case.js';
import { GetTaskTemplate } from '../../../../application/use-cases/queries/templates/get-task-template/get-task-template.use-case.js';
import { DeleteTaskTemplate } from '../../../../application/use-cases/commands/templates/delete-task-template/delete-task-template.use-case.js';

/** Client errors declared for a page of templates. */
const LIST: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};
/** Client errors declared for a template read. */
const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['template.not-found', 'space.not-found', 'organization.not-found'],
};
/** Client errors declared for creating a template. */
const CREATE: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['space.not-found', 'task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: ['template.source-restricted', 'template.limit-reached', 'idempotency.key-reused'],
};
/** Client errors declared for deleting a template. */
const REMOVE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  412: ['request.version-mismatch'],
};

/** Public task template routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskTemplatesController {
  // #region Properties
  /** Use case for listTaskTemplates. */
  private readonly listTaskTemplatesUseCase: ListTaskTemplates;

  /** Use case for createTaskTemplate. */
  private readonly createTaskTemplateUseCase: CreateTaskTemplate;

  /** Use case for getTaskTemplate. */
  private readonly getTaskTemplateUseCase: GetTaskTemplate;

  /** Use case for deleteTaskTemplate. */
  private readonly deleteTaskTemplateUseCase: DeleteTaskTemplate;
  // #endregion

  // #region Constructor
  /** Binds the route use cases. */
  public constructor(
    @Inject(ListTaskTemplates) listTaskTemplates: ListTaskTemplates,
    @Inject(CreateTaskTemplate) createTaskTemplate: CreateTaskTemplate,
    @Inject(GetTaskTemplate) getTaskTemplate: GetTaskTemplate,
    @Inject(DeleteTaskTemplate) deleteTaskTemplate: DeleteTaskTemplate,
  ) {
    this.listTaskTemplatesUseCase = listTaskTemplates;
    this.createTaskTemplateUseCase = createTaskTemplate;
    this.getTaskTemplateUseCase = getTaskTemplate;
    this.deleteTaskTemplateUseCase = deleteTaskTemplate;
  }
  // #endregion

  // #region Methods
  /** Lists the templates visible in a space. */
  @Get('spaces/:spaceId/task-templates')
  @CredentialGuard.requires({
    operationId: 'listTaskTemplates',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listTaskTemplates(
    @Param(new ZodValidationPipe(ListTaskTemplatesParams))
    params: z.output<typeof ListTaskTemplatesParams>,
    @Query(new ZodValidationPipe(ListTaskTemplatesQueryParams))
    query: z.output<typeof ListTaskTemplatesQueryParams>,
  ): Promise<z.output<typeof ListTaskTemplatesResponse>> {
    return conformBody(
      'task-service',
      'listTaskTemplates',
      ListTaskTemplatesResponse,
      await relayProblems(LIST, () => this.listTaskTemplatesUseCase.execute(params.spaceId, query)),
    );
  }

  /** Creates a template with its public location and ETag. */
  @Post('spaces/:spaceId/task-templates')
  @CredentialGuard.requires({
    operationId: 'createTaskTemplate',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async createTaskTemplate(
    @Param(new ZodValidationPipe(CreateTaskTemplateParams))
    params: z.output<typeof CreateTaskTemplateParams>,
    @RequiredBody(CreateTaskTemplateBody) body: z.output<typeof CreateTaskTemplateBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateTaskTemplateResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateTaskTemplateHeader.shape['Idempotency-Key'],
      key,
    );
    const template = conformBody(
      'task-service',
      'createTaskTemplate',
      CreateTaskTemplateResponse,
      await relayProblems(CREATE, () =>
        this.createTaskTemplateUseCase.execute(params.spaceId, body, idempotencyKey),
      ),
    );
    response.setHeader('ETag', formatEtag(template.version));
    response.setHeader('Location', `/v1/spaces/${template.spaceId}/task-templates/${template.id}`);
    return template;
  }

  /** Reads a template and its ETag. */
  @Get('spaces/:spaceId/task-templates/:templateId')
  @CredentialGuard.requires({
    operationId: 'getTaskTemplate',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getTaskTemplate(
    @Param(new ZodValidationPipe(GetTaskTemplateParams))
    params: z.output<typeof GetTaskTemplateParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskTemplateResponse>> {
    const template = conformBody(
      'task-service',
      'getTaskTemplate',
      GetTaskTemplateResponse,
      await relayProblems(READ, () =>
        this.getTaskTemplateUseCase.execute(params.spaceId, params.templateId),
      ),
    );
    response.setHeader('ETag', formatEtag(template.version));
    return template;
  }

  /** Deletes a template once with an optional version precondition. */
  @Delete('spaces/:spaceId/task-templates/:templateId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteTaskTemplate',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async deleteTaskTemplate(
    @Param(new ZodValidationPipe(DeleteTaskTemplateParams))
    params: z.output<typeof DeleteTaskTemplateParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    return relayProblems(REMOVE, () =>
      this.deleteTaskTemplateUseCase.execute(params.spaceId, params.templateId, ifMatch),
    );
  }
  // #endregion
}
