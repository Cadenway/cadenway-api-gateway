import {
  ListFavoritesQueryParams,
  ListFavoritesResponse,
  CreateFavoriteHeader,
  CreateFavoriteBody,
  CreateFavoriteResponse,
  GetFavoriteParams,
  GetFavoriteResponse,
  DeleteFavoriteParams,
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
import { ListFavorites } from '../../../../application/use-cases/queries/favorites/list-favorites/list-favorites.use-case.js';
import { CreateFavorite } from '../../../../application/use-cases/commands/favorites/create-favorite/create-favorite.use-case.js';
import { GetFavorite } from '../../../../application/use-cases/queries/favorites/get-favorite/get-favorite.use-case.js';
import { DeleteFavorite } from '../../../../application/use-cases/commands/favorites/delete-favorite/delete-favorite.use-case.js';

/** Errors declared for the favorites page. */
const LIST: AcceptedProblems = { 400: ['request.invalid'], 404: ['organization.not-found'] };
/** Errors declared for reading a favorite. */
const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['favorite.not-found', 'organization.not-found'],
};
/** Errors declared for creating a favorite. */
const CREATE: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['favorite.target-not-found', 'organization.not-found'],
  409: ['favorite.already-exists', 'idempotency.request-in-progress'],
  422: ['favorite.limit-reached', 'idempotency.key-reused'],
};
/** Errors declared for deleting a favorite. */
const REMOVE: AcceptedProblems = { ...READ, 412: ['request.version-mismatch'] };

/** Public current-user favorite routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class FavoritesController {
  // #region Properties
  /** Use case for listFavorites. */
  private readonly listFavoritesUseCase: ListFavorites;

  /** Use case for createFavorite. */
  private readonly createFavoriteUseCase: CreateFavorite;

  /** Use case for getFavorite. */
  private readonly getFavoriteUseCase: GetFavorite;

  /** Use case for deleteFavorite. */
  private readonly deleteFavoriteUseCase: DeleteFavorite;
  // #endregion

  // #region Constructor
  /** Binds the route use cases. */
  public constructor(
    @Inject(ListFavorites) listFavorites: ListFavorites,
    @Inject(CreateFavorite) createFavorite: CreateFavorite,
    @Inject(GetFavorite) getFavorite: GetFavorite,
    @Inject(DeleteFavorite) deleteFavorite: DeleteFavorite,
  ) {
    this.listFavoritesUseCase = listFavorites;
    this.createFavoriteUseCase = createFavorite;
    this.getFavoriteUseCase = getFavorite;
    this.deleteFavoriteUseCase = deleteFavorite;
  }
  // #endregion

  // #region Methods
  /** Lists the current actor's favorites. */
  @Get('me/favorites')
  @CredentialGuard.requires({
    operationId: 'listFavorites',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listFavorites(
    @Query(new ZodValidationPipe(ListFavoritesQueryParams))
    query: z.output<typeof ListFavoritesQueryParams>,
  ): Promise<z.output<typeof ListFavoritesResponse>> {
    return conformBody(
      'task-service',
      'listFavorites',
      ListFavoritesResponse,
      await relayProblems(LIST, () => this.listFavoritesUseCase.execute(query)),
    );
  }

  /** Creates a favorite with its public location and ETag. */
  @Post('me/favorites')
  @CredentialGuard.requires({
    operationId: 'createFavorite',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createFavorite(
    @RequiredBody(CreateFavoriteBody) body: z.output<typeof CreateFavoriteBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateFavoriteResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateFavoriteHeader.shape['Idempotency-Key'],
      key,
    );
    const favorite = conformBody(
      'task-service',
      'createFavorite',
      CreateFavoriteResponse,
      await relayProblems(CREATE, () => this.createFavoriteUseCase.execute(body, idempotencyKey)),
    );
    response.setHeader('ETag', formatEtag(favorite.version));
    response.setHeader('Location', `/v1/me/favorites/${favorite.id}`);
    return favorite;
  }

  /** Reads a favorite and its ETag. */
  @Get('me/favorites/:favoriteId')
  @CredentialGuard.requires({
    operationId: 'getFavorite',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getFavorite(
    @Param(new ZodValidationPipe(GetFavoriteParams)) params: z.output<typeof GetFavoriteParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetFavoriteResponse>> {
    const favorite = conformBody(
      'task-service',
      'getFavorite',
      GetFavoriteResponse,
      await relayProblems(READ, () => this.getFavoriteUseCase.execute(params.favoriteId)),
    );
    response.setHeader('ETag', formatEtag(favorite.version));
    return favorite;
  }

  /** Deletes a favorite once with an optional version precondition. */
  @Delete('me/favorites/:favoriteId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteFavorite',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async deleteFavorite(
    @Param(new ZodValidationPipe(DeleteFavoriteParams))
    params: z.output<typeof DeleteFavoriteParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    return relayProblems(REMOVE, () =>
      this.deleteFavoriteUseCase.execute(params.favoriteId, ifMatch),
    );
  }
  // #endregion
}
