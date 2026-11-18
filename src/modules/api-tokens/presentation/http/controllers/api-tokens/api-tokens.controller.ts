import type { ApiTokenCreated, ApiTokenPage } from '@cadenway/contracts/types/public/api-tokens';
import {
  CreateApiTokenBody,
  ListApiTokensQueryParams,
  RevokeApiTokenParams,
} from '@cadenway/contracts/validators/public/api-tokens';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';

import {
  relaySessionUpstream,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateApiToken } from '../../../../application/use-cases/commands/api-tokens/create-api-token/create-api-token.use-case.js';
import { RevokeApiToken } from '../../../../application/use-cases/commands/api-tokens/revoke-api-token/revoke-api-token.use-case.js';
import { ListApiTokens } from '../../../../application/use-cases/queries/api-tokens/list-api-tokens/list-api-tokens.use-case.js';
import type { CreateApiTokenOutput } from '../../../../application/use-cases/commands/api-tokens/create-api-token/create-api-token.output.js';
import { toApiTokenCreated, toApiTokenPage } from '../../mappers/api-tokens/api-token.mapper.js';

/**
 * Constant INVALID_REQUEST_ONLY
 *
 * @description
 * Client errors of identity-service that the list answers as they are.
 *
 * @type {AcceptedProblems}
 */
const INVALID_REQUEST_ONLY: AcceptedProblems = { 400: ['request.invalid'] };

/**
 * Constant CREATE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `POST /v1/api-tokens` answers as they are: an invalid
 * request, and `403 auth.reauthentication-required` (with `details.methods`) when the session has
 * no recent authentication.
 *
 * @type {AcceptedProblems}
 */
const CREATE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['auth.reauthentication-required'],
};

/**
 * Constant CREATE_ENDED_SESSION
 *
 * @description
 * The internal `404` code of the creation that ends the session for the applications
 * (`401 auth.session-expired`): the session of the request is no longer open.
 *
 * @type {readonly string[]}
 */
const CREATE_ENDED_SESSION: readonly string[] = ['session.not-found'];

/**
 * Constant REVOKE_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `DELETE /v1/api-tokens/{apiTokenId}` answers as they
 * are.
 *
 * @type {AcceptedProblems}
 */
const REVOKE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['api-token.not-found'],
};

/**
 * Constant LIST_QUERY
 *
 * @description
 * The query of `GET /v1/api-tokens` as the contract validates it; its generated validator reads
 * `limit` from its text.
 *
 * @type {z.ZodType<z.output<typeof ListApiTokensQueryParams>>}
 */
const LIST_QUERY = ListApiTokensQueryParams;

/**
 * Class ApiTokensController
 *
 * @description
 * The routes of `openapi/public/api-tokens.yaml`: create, list and revoke the personal API tokens
 * of the caller in the current organization. Session only: a token never manages tokens
 * (`403 auth.api-token-not-accepted`), and a session without a current organization gets
 * `403 organization.not-selected`, both from `CredentialGuard` before any call; `RateLimitGuard`
 * counts the session. The creation sends the session of the request, whose recent authentication
 * identity-service checks (`403 auth.reauthentication-required`). The secret of a created token
 * leaves the gateway in the body of the creation only, once; it is never logged.
 */
@Controller('v1/api-tokens')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ApiTokensController {
  // #region Properties
  /**
   * Property creation
   *
   * @description
   * Creates a token.
   *
   * @type {CreateApiToken}
   * @readonly
   */
  private readonly creation: CreateApiToken;

  /**
   * Property listing
   *
   * @description
   * Lists the tokens.
   *
   * @type {ListApiTokens}
   * @readonly
   */
  private readonly listing: ListApiTokens;

  /**
   * Property revocation
   *
   * @description
   * Revokes a token.
   *
   * @type {RevokeApiToken}
   * @readonly
   */
  private readonly revocation: RevokeApiToken;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the token routes.
   *
   * @param {CreateApiToken} creation - Creates a token.
   * @param {ListApiTokens} listing - Lists the tokens.
   * @param {RevokeApiToken} revocation - Revokes a token.
   * @constructor
   */
  public constructor(
    @Inject(CreateApiToken) creation: CreateApiToken,
    @Inject(ListApiTokens) listing: ListApiTokens,
    @Inject(RevokeApiToken) revocation: RevokeApiToken,
  ) {
    this.creation = creation;
    this.listing = listing;
    this.revocation = revocation;
  }
  // #endregion

  // #region Methods
  /**
   * Method createApiToken
   *
   * @description
   * `POST /v1/api-tokens`: a token of the caller in the current organization. `201` with
   * `Location: /v1/api-tokens/<apiTokenId>`, the URL that revokes it. The session of the request,
   * as the introspection returned it, travels as `sessionId`: without a recent authentication of
   * that session, identity-service answers `403 auth.reauthentication-required`, relayed with its
   * `details.methods`; a session that ended since its introspection is `401 auth.session-expired`.
   *
   * @param {z.output<typeof CreateApiTokenBody>} body - Name, scopes and expiration.
   * @param {Request} request - Request, for its verified session.
   * @param {Response} response - Response, for `Location`.
   * @returns {Promise<ApiTokenCreated>} The token and its secret, once.
   */
  @Post()
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'createApiToken',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async createApiToken(
    @Body(new ZodValidationPipe(CreateApiTokenBody)) body: z.output<typeof CreateApiTokenBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiTokenCreated> {
    const session: RequestSession | undefined = verifiedSessionOf(request);
    if (session === undefined) {
      throw new Error('POST /v1/api-tokens ran without a verified session.');
    }
    const created: CreateApiTokenOutput = await relaySessionUpstream(
      response,
      CREATE_PROBLEMS,
      () =>
        this.creation.execute({
          sessionId: session.sessionId,
          name: body.name,
          scopes: body.scopes,
          expiration: body.expiration,
        }),
      CREATE_ENDED_SESSION,
    );
    response.setHeader('Location', `/v1/api-tokens/${created.apiToken.id}`);
    return toApiTokenCreated(created);
  }

  /**
   * Method listApiTokens
   *
   * @description
   * `GET /v1/api-tokens`: one page of the active tokens, never with their secret.
   *
   * @param {z.output<typeof LIST_QUERY>} query - Cursor and page size.
   * @returns {Promise<ApiTokenPage>} One page of tokens.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listApiTokens',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async listApiTokens(
    @Query(new ZodValidationPipe(LIST_QUERY)) query: z.output<typeof LIST_QUERY>,
  ): Promise<ApiTokenPage> {
    return toApiTokenPage(
      await this.relay(INVALID_REQUEST_ONLY, () =>
        this.listing.execute({
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          limit: query.limit,
        }),
      ),
    );
  }

  /**
   * Method revokeApiToken
   *
   * @description
   * `DELETE /v1/api-tokens/{apiTokenId}`: revokes the token. `204`, also for a token revoked
   * already; the next request with it answers `401 auth.api-token-invalid`.
   *
   * @param {z.output<typeof RevokeApiTokenParams>} params - The id of the token.
   * @returns {Promise<void>} Resolves once the token is revoked.
   */
  @Delete(':apiTokenId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'revokeApiToken',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async revokeApiToken(
    @Param(new ZodValidationPipe(RevokeApiTokenParams))
    params: z.output<typeof RevokeApiTokenParams>,
  ): Promise<void> {
    await this.relay(REVOKE_PROBLEMS, () => this.revocation.execute(params.apiTokenId));
  }

  /**
   * Method relay
   *
   * @description
   * Runs a use case and translates its failure into the public problem of the route (see
   * `toPublicProblem`).
   *
   * @param {AcceptedProblems} accepted - Client errors the public operation declares.
   * @param {() => Promise<TResult>} call - The use case.
   * @returns {Promise<TResult>} What the use case resolved with.
   */
  private async relay<TResult>(
    accepted: AcceptedProblems,
    call: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await call();
    } catch (error) {
      throw toPublicProblem(error, accepted);
    }
  }
  // #endregion
}
