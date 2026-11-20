import {
  ListListCustomFieldsParams,
  ListListCustomFieldsQueryParams,
  ListListCustomFieldsResponse,
} from '@cadenway/contracts/validators/public/lists';
import {
  ListSpaceCustomFieldsParams,
  ListSpaceCustomFieldsQueryParams,
  ListSpaceCustomFieldsResponse,
  CreateSpaceCustomFieldParams,
  CreateSpaceCustomFieldHeader,
  CreateSpaceCustomFieldBody,
  CreateSpaceCustomFieldResponse,
  GetSpaceCustomFieldParams,
  GetSpaceCustomFieldResponse,
  UpdateSpaceCustomFieldParams,
  UpdateSpaceCustomFieldBody,
  UpdateSpaceCustomFieldResponse,
  RetireSpaceCustomFieldParams,
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
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/create-space-custom-field/create-space-custom-field.use-case.js';
import { UpdateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/update-space-custom-field/update-space-custom-field.use-case.js';
import { RetireSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/retire-space-custom-field/retire-space-custom-field.use-case.js';
import { ListSpaceCustomFields } from '../../../../application/use-cases/queries/custom-field/list-space-custom-fields/list-space-custom-fields.use-case.js';
import { GetSpaceCustomField } from '../../../../application/use-cases/queries/custom-field/get-space-custom-field/get-space-custom-field.use-case.js';
import { ListListCustomFields } from '../../../../application/use-cases/queries/custom-field/list-list-custom-fields/list-list-custom-fields.use-case.js';

/** Refusals common to the definition collection and its items. */
const LIST_SPACE: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};
/** Refusals for a single active definition. */
const READ: AcceptedProblems = {
  ...LIST_SPACE,
  404: ['space.not-found', 'organization.not-found', 'custom-field.not-found'],
};
/** Refusals common to manager writes. */
const WRITE: AcceptedProblems = {
  ...READ,
  403: ['space.manage-forbidden'],
  412: ['request.version-mismatch'],
};
/** Creation refusals. */
const CREATE: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['space.manage-forbidden'],
  404: ['space.not-found', 'organization.not-found'],
  409: ['idempotency.request-in-progress'],
  422: ['custom-field.limit-reached', 'idempotency.key-reused'],
};
/** Update refusals. */
const UPDATE: AcceptedProblems = {
  ...WRITE,
  422: ['custom-field.position-invalid', 'custom-field.sprint-points-invalid'],
};

/** Public custom field definition routes for spaces and visible lists. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class CustomFieldsController {
  // #region Constructor
  /** Binds custom field use cases. */
  public constructor(
    @Inject(ListSpaceCustomFields) private readonly listSpace: ListSpaceCustomFields,
    @Inject(CreateSpaceCustomField) private readonly createField: CreateSpaceCustomField,
    @Inject(GetSpaceCustomField) private readonly getField: GetSpaceCustomField,
    @Inject(UpdateSpaceCustomField) private readonly updateField: UpdateSpaceCustomField,
    @Inject(RetireSpaceCustomField) private readonly retireField: RetireSpaceCustomField,
    @Inject(ListListCustomFields) private readonly listList: ListListCustomFields,
  ) {}
  // #endregion

  // #region Methods
  /** Lists active definitions for a visible space. */
  @Get('spaces/:spaceId/custom-fields')
  @CredentialGuard.requires({
    operationId: 'listSpaceCustomFields',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async list(
    @Param(new ZodValidationPipe(ListSpaceCustomFieldsParams))
    params: z.output<typeof ListSpaceCustomFieldsParams>,
    @Query(new ZodValidationPipe(ListSpaceCustomFieldsQueryParams))
    query: z.output<typeof ListSpaceCustomFieldsQueryParams>,
  ): Promise<z.output<typeof ListSpaceCustomFieldsResponse>> {
    return conformBody(
      'task-service',
      'listSpaceCustomFields',
      ListSpaceCustomFieldsResponse,
      await relayProblems(LIST_SPACE, () => this.listSpace.execute(params.spaceId, query)),
    );
  }

  /** Creates a field and returns its location and version. */
  @Post('spaces/:spaceId/custom-fields')
  @CredentialGuard.requires({
    operationId: 'createSpaceCustomField',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async create(
    @Param(new ZodValidationPipe(CreateSpaceCustomFieldParams))
    params: z.output<typeof CreateSpaceCustomFieldParams>,
    @RequiredBody(CreateSpaceCustomFieldBody) body: z.output<typeof CreateSpaceCustomFieldBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateSpaceCustomFieldResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateSpaceCustomFieldHeader.shape['Idempotency-Key'],
      key,
    );
    const result = await relayProblems(CREATE, () =>
      this.createField.execute(params.spaceId, body, idempotencyKey),
    );
    const field = conformBody(
      'task-service',
      'createSpaceCustomField',
      CreateSpaceCustomFieldResponse,
      result.field,
    );
    if (
      field.spaceId.toLowerCase() !== params.spaceId.toLowerCase() ||
      field.version !== result.version
    )
      throw outsideContract(
        'task-service',
        'createSpaceCustomField',
        'a field outside the space or an inconsistent version',
      );
    response.setHeader('Location', `/v1/spaces/${params.spaceId}/custom-fields/${field.id}`);
    response.setHeader('ETag', formatEtag(result.version));
    return field;
  }

  /** Reads one active definition. */
  @Get('spaces/:spaceId/custom-fields/:fieldId')
  @CredentialGuard.requires({
    operationId: 'getSpaceCustomField',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetSpaceCustomFieldParams))
    params: z.output<typeof GetSpaceCustomFieldParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetSpaceCustomFieldResponse>> {
    const result = await relayProblems(READ, () =>
      this.getField.execute(params.spaceId, params.fieldId),
    );
    const field = conformBody(
      'task-service',
      'getSpaceCustomField',
      GetSpaceCustomFieldResponse,
      result.field,
    );
    if (
      field.spaceId.toLowerCase() !== params.spaceId.toLowerCase() ||
      field.id !== params.fieldId ||
      field.version !== result.version
    )
      throw outsideContract(
        'task-service',
        'getSpaceCustomField',
        'a different field or an inconsistent version',
      );
    response.setHeader('ETag', formatEtag(result.version));
    return field;
  }

  /** Updates a definition under the supplied version condition. */
  @Patch('spaces/:spaceId/custom-fields/:fieldId')
  @CredentialGuard.requires({
    operationId: 'updateSpaceCustomField',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async update(
    @Param(new ZodValidationPipe(UpdateSpaceCustomFieldParams))
    params: z.output<typeof UpdateSpaceCustomFieldParams>,
    @RequiredBody(UpdateSpaceCustomFieldBody) body: z.output<typeof UpdateSpaceCustomFieldBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateSpaceCustomFieldResponse>> {
    const result = await relayProblems(UPDATE, () =>
      this.updateField.execute(params.spaceId, params.fieldId, body, ifMatch),
    );
    const field = conformBody(
      'task-service',
      'updateSpaceCustomField',
      UpdateSpaceCustomFieldResponse,
      result.field,
    );
    if (
      field.spaceId.toLowerCase() !== params.spaceId.toLowerCase() ||
      field.id !== params.fieldId ||
      field.version !== result.version
    )
      throw outsideContract(
        'task-service',
        'updateSpaceCustomField',
        'a different field or an inconsistent version',
      );
    response.setHeader('ETag', formatEtag(result.version));
    return field;
  }

  /** Retires a definition. */
  @Delete('spaces/:spaceId/custom-fields/:fieldId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'retireSpaceCustomField',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async retire(
    @Param(new ZodValidationPipe(RetireSpaceCustomFieldParams))
    params: z.output<typeof RetireSpaceCustomFieldParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    await relayProblems(WRITE, () =>
      this.retireField.execute(params.spaceId, params.fieldId, ifMatch),
    );
  }

  /** Lists active definitions through a visible list. */
  @Get('lists/:listId/custom-fields')
  @CredentialGuard.requires({
    operationId: 'listListCustomFields',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listForList(
    @Param(new ZodValidationPipe(ListListCustomFieldsParams))
    params: z.output<typeof ListListCustomFieldsParams>,
    @Query(new ZodValidationPipe(ListListCustomFieldsQueryParams))
    query: z.output<typeof ListListCustomFieldsQueryParams>,
  ): Promise<z.output<typeof ListListCustomFieldsResponse>> {
    return conformBody(
      'task-service',
      'listListCustomFields',
      ListListCustomFieldsResponse,
      await relayProblems(
        { 400: ['request.invalid'], 404: ['list.not-found', 'organization.not-found'] },
        () => this.listList.execute(params.listId, query),
      ),
    );
  }
  // #endregion
}
