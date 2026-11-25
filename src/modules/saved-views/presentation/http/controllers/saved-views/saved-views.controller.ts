import {
  ListSavedViewsParams,
  ListSavedViewsQueryParams,
  ListSavedViewsResponse,
  CreateSavedViewParams,
  CreateSavedViewHeader,
  CreateSavedViewBody,
  CreateSavedViewResponse,
  GetSavedViewParams,
  GetSavedViewResponse,
  UpdateSavedViewParams,
  UpdateSavedViewBody,
  UpdateSavedViewResponse,
  DeleteSavedViewParams,
  DuplicateSavedViewParams,
  DuplicateSavedViewHeader,
  DuplicateSavedViewBody,
  DuplicateSavedViewResponse,
} from '@cadenway/contracts/validators/public/lists';
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
import { ListSavedViews } from '../../../../application/use-cases/queries/views/list-saved-views/list-saved-views.use-case.js';
import { CreateSavedView } from '../../../../application/use-cases/commands/views/create-saved-view/create-saved-view.use-case.js';
import { GetSavedView } from '../../../../application/use-cases/queries/views/get-saved-view/get-saved-view.use-case.js';
import { UpdateSavedView } from '../../../../application/use-cases/commands/views/update-saved-view/update-saved-view.use-case.js';
import { DeleteSavedView } from '../../../../application/use-cases/commands/views/delete-saved-view/delete-saved-view.use-case.js';
import { DuplicateSavedView } from '../../../../application/use-cases/commands/views/duplicate-saved-view/duplicate-saved-view.use-case.js';

/** Client errors of a saved view list. */
const LIST: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};
/** Client errors of a saved view read. */
const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['saved-view.not-found', 'list.not-found', 'organization.not-found'],
};
/** Client errors of creating a view. */
const CREATE: AcceptedProblems = {
  ...LIST,
  403: ['access.role-insufficient'],
  409: ['saved-view.list-archived', 'idempotency.request-in-progress'],
  422: ['saved-view.limit-reached', 'idempotency.key-reused'],
};
/** Client errors of changing or deleting a view. */
const CHANGE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['saved-view.list-archived'],
  412: ['request.version-mismatch'],
};
/** Client errors of duplicating a view. */
const DUPLICATE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['saved-view.list-archived', 'idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: ['saved-view.limit-reached', 'idempotency.key-reused'],
};

/** Public saved view routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class SavedViewsController {
  // #region Properties
  /** Use case for listSavedViews. */
  private readonly listSavedViewsUseCase: ListSavedViews;

  /** Use case for createSavedView. */
  private readonly createSavedViewUseCase: CreateSavedView;

  /** Use case for getSavedView. */
  private readonly getSavedViewUseCase: GetSavedView;

  /** Use case for updateSavedView. */
  private readonly updateSavedViewUseCase: UpdateSavedView;

  /** Use case for deleteSavedView. */
  private readonly deleteSavedViewUseCase: DeleteSavedView;

  /** Use case for duplicateSavedView. */
  private readonly duplicateSavedViewUseCase: DuplicateSavedView;
  // #endregion

  // #region Constructor
  /** Binds the route use cases. */
  public constructor(
    @Inject(ListSavedViews) listSavedViews: ListSavedViews,
    @Inject(CreateSavedView) createSavedView: CreateSavedView,
    @Inject(GetSavedView) getSavedView: GetSavedView,
    @Inject(UpdateSavedView) updateSavedView: UpdateSavedView,
    @Inject(DeleteSavedView) deleteSavedView: DeleteSavedView,
    @Inject(DuplicateSavedView) duplicateSavedView: DuplicateSavedView,
  ) {
    this.listSavedViewsUseCase = listSavedViews;
    this.createSavedViewUseCase = createSavedView;
    this.getSavedViewUseCase = getSavedView;
    this.updateSavedViewUseCase = updateSavedView;
    this.deleteSavedViewUseCase = deleteSavedView;
    this.duplicateSavedViewUseCase = duplicateSavedView;
  }
  // #endregion

  // #region Methods
  /** Lists the saved views visible in a list. */
  @Get('lists/:listId/saved-views')
  @CredentialGuard.requires({
    operationId: 'listSavedViews',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listSavedViews(
    @Param(new ZodValidationPipe(ListSavedViewsParams))
    params: z.output<typeof ListSavedViewsParams>,
    @Query(new ZodValidationPipe(ListSavedViewsQueryParams))
    query: z.output<typeof ListSavedViewsQueryParams>,
  ): Promise<z.output<typeof ListSavedViewsResponse>> {
    return conformBody(
      'task-service',
      'listSavedViews',
      ListSavedViewsResponse,
      await relayProblems(LIST, () => this.listSavedViewsUseCase.execute(params.listId, query)),
    );
  }

  /** Creates a view with its public location and ETag. */
  @Post('lists/:listId/saved-views')
  @CredentialGuard.requires({
    operationId: 'createSavedView',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async createSavedView(
    @Param(new ZodValidationPipe(CreateSavedViewParams))
    params: z.output<typeof CreateSavedViewParams>,
    @RequiredBody(CreateSavedViewBody) body: z.output<typeof CreateSavedViewBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateSavedViewResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateSavedViewHeader.shape['Idempotency-Key'],
      key,
    );
    const view = conformBody(
      'task-service',
      'createSavedView',
      CreateSavedViewResponse,
      await relayProblems(CREATE, () =>
        this.createSavedViewUseCase.execute(params.listId, body, idempotencyKey),
      ),
    );
    response.setHeader('ETag', formatEtag(view.version));
    response.setHeader('Location', `/v1/lists/${view.listId}/saved-views/${view.id}`);
    return view;
  }

  /** Reads a saved view and its ETag. */
  @Get('lists/:listId/saved-views/:viewId')
  @CredentialGuard.requires({
    operationId: 'getSavedView',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getSavedView(
    @Param(new ZodValidationPipe(GetSavedViewParams)) params: z.output<typeof GetSavedViewParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetSavedViewResponse>> {
    const view = conformBody(
      'task-service',
      'getSavedView',
      GetSavedViewResponse,
      await relayProblems(READ, () =>
        this.getSavedViewUseCase.execute(params.listId, params.viewId),
      ),
    );
    response.setHeader('ETag', formatEtag(view.version));
    return view;
  }

  /** Patches a view once with its optional version precondition. */
  @Patch('lists/:listId/saved-views/:viewId')
  @CredentialGuard.requires({
    operationId: 'updateSavedView',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateSavedView(
    @Param(new ZodValidationPipe(UpdateSavedViewParams))
    params: z.output<typeof UpdateSavedViewParams>,
    @RequiredBody(UpdateSavedViewBody) body: z.output<typeof UpdateSavedViewBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateSavedViewResponse>> {
    const view = conformBody(
      'task-service',
      'updateSavedView',
      UpdateSavedViewResponse,
      await relayProblems(CHANGE, () =>
        this.updateSavedViewUseCase.execute(params.listId, params.viewId, body, ifMatch),
      ),
    );
    response.setHeader('ETag', formatEtag(view.version));
    return view;
  }

  /** Deletes a view once with its optional version precondition. */
  @Delete('lists/:listId/saved-views/:viewId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteSavedView',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async deleteSavedView(
    @Param(new ZodValidationPipe(DeleteSavedViewParams))
    params: z.output<typeof DeleteSavedViewParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    return relayProblems(CHANGE, () =>
      this.deleteSavedViewUseCase.execute(params.listId, params.viewId, ifMatch),
    );
  }

  /** Duplicates a view with its public location and ETag. */
  @Post('lists/:listId/saved-views/:viewId/duplicate')
  @CredentialGuard.requires({
    operationId: 'duplicateSavedView',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async duplicateSavedView(
    @Param(new ZodValidationPipe(DuplicateSavedViewParams))
    params: z.output<typeof DuplicateSavedViewParams>,
    @RequiredBody(DuplicateSavedViewBody) body: z.output<typeof DuplicateSavedViewBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof DuplicateSavedViewResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      DuplicateSavedViewHeader.shape['Idempotency-Key'],
      key,
    );
    const view = conformBody(
      'task-service',
      'duplicateSavedView',
      DuplicateSavedViewResponse,
      await relayProblems(DUPLICATE, () =>
        this.duplicateSavedViewUseCase.execute(
          params.listId,
          params.viewId,
          body,
          ifMatch,
          idempotencyKey,
        ),
      ),
    );
    response.setHeader('ETag', formatEtag(view.version));
    response.setHeader('Location', `/v1/lists/${view.listId}/saved-views/${view.id}`);
    return view;
  }
  // #endregion
}
