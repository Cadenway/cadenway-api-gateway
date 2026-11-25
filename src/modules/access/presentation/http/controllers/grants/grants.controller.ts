import {
  ListListGrantsParams,
  ListListGrantsQueryParams,
  ListListGrantsResponse,
  ListSpaceGrantsParams,
  ListSpaceGrantsQueryParams,
  ListSpaceGrantsResponse,
  RemoveListGrantParams,
  RemoveSpaceGrantParams,
  SetListGrantBody,
  SetListGrantParams,
  SetListGrantResponse,
  SetSpaceGrantBody,
  SetSpaceGrantParams,
  SetSpaceGrantResponse,
} from '@cadenway/contracts/validators/public/access';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
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
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import type { VersionedGrant } from '../../../../application/models/grants/versioned-grant.model.js';
import { RemoveListGrant } from '../../../../application/use-cases/commands/grants/remove-list-grant/remove-list-grant.use-case.js';
import { RemoveSpaceGrant } from '../../../../application/use-cases/commands/grants/remove-space-grant/remove-space-grant.use-case.js';
import { SetListGrant } from '../../../../application/use-cases/commands/grants/set-list-grant/set-list-grant.use-case.js';
import { SetSpaceGrant } from '../../../../application/use-cases/commands/grants/set-space-grant/set-space-grant.use-case.js';
import { ListListGrants } from '../../../../application/use-cases/queries/grants/list-list-grants/list-list-grants.use-case.js';
import { ListSpaceGrants } from '../../../../application/use-cases/queries/grants/list-space-grants/list-space-grants.use-case.js';

/**
 * Constant TASK_SERVICE
 *
 * @description
 * The service the routes of this controller relay, as `details.service` of the problem of an
 * answer the public contract cannot carry.
 *
 * @type {string}
 */
const TASK_SERVICE: string = 'task-service';

/**
 * Constant GRANT_REFUSALS
 *
 * @description
 * The `422` codes of `GrantRefused` in `openapi/public/access.yaml`, which both `PUT` operations
 * declare.
 *
 * @type {readonly string[]}
 */
const GRANT_REFUSALS: readonly string[] = [
  'access.grantee-invalid',
  'access.guest-space-forbidden',
  'access.owner-unchangeable',
  'access.grant-limit-reached',
];

/**
 * Constant LIST_SPACE_GRANTS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/spaces/{spaceId}/grants` answers as they are: the
 * codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_SPACE_GRANTS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};

/**
 * Constant SET_SPACE_GRANT_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PUT /v1/spaces/{spaceId}/grants/{userId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const SET_SPACE_GRANT_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['space.manage-forbidden'],
  404: ['space.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
  422: GRANT_REFUSALS,
};

/**
 * Constant REMOVE_SPACE_GRANT_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/spaces/{spaceId}/grants/{userId}` answers as
 * they are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const REMOVE_SPACE_GRANT_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['space.manage-forbidden'],
  404: ['space.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
  422: ['access.owner-unchangeable'],
};

/**
 * Constant LIST_LIST_GRANTS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}/grants` answers as they are: the
 * codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_LIST_GRANTS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant SET_LIST_GRANT_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PUT /v1/lists/{listId}/grants/{userId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const SET_LIST_GRANT_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
  422: GRANT_REFUSALS,
};

/**
 * Constant REMOVE_LIST_GRANT_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/lists/{listId}/grants/{userId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const REMOVE_LIST_GRANT_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  412: ['request.version-mismatch'],
  422: ['access.owner-unchangeable'],
};

/**
 * Class GrantsController
 *
 * @description
 * The grant routes of `openapi/public/access.yaml`: list, give or change, and remove the grants of
 * a space and of a list, one person at a time.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (reads) or
 * `tasks:write` (changes), on the current organization: `CredentialGuard` answers
 * `403 auth.scope-missing`, `403 organization.not-selected` and `403 organization.mfa-required`
 * before any call, and `RateLimitGuard` counts the credential. task-service decides who manages a
 * grant and every rule of one; the gateway relays the client errors each public operation
 * declares, with their French titles, and maps every answer to the public contract through its
 * public validator. A change answers the version of the space or the list as `ETag`, which the
 * `Grant` does not carry.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class GrantsController {
  // #region Properties
  /**
   * Property spaceGrantListing
   *
   * @description
   * Use case `ListSpaceGrants`.
   *
   * @type {ListSpaceGrants}
   * @readonly
   */
  private readonly spaceGrantListing: ListSpaceGrants;

  /**
   * Property spaceGrantChange
   *
   * @description
   * Use case `SetSpaceGrant`.
   *
   * @type {SetSpaceGrant}
   * @readonly
   */
  private readonly spaceGrantChange: SetSpaceGrant;

  /**
   * Property spaceGrantRemoval
   *
   * @description
   * Use case `RemoveSpaceGrant`.
   *
   * @type {RemoveSpaceGrant}
   * @readonly
   */
  private readonly spaceGrantRemoval: RemoveSpaceGrant;

  /**
   * Property listGrantListing
   *
   * @description
   * Use case `ListListGrants`.
   *
   * @type {ListListGrants}
   * @readonly
   */
  private readonly listGrantListing: ListListGrants;

  /**
   * Property listGrantChange
   *
   * @description
   * Use case `SetListGrant`.
   *
   * @type {SetListGrant}
   * @readonly
   */
  private readonly listGrantChange: SetListGrant;

  /**
   * Property listGrantRemoval
   *
   * @description
   * Use case `RemoveListGrant`.
   *
   * @type {RemoveListGrant}
   * @readonly
   */
  private readonly listGrantRemoval: RemoveListGrant;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ListSpaceGrants} spaceGrantListing - Use case `ListSpaceGrants`.
   * @param {SetSpaceGrant} spaceGrantChange - Use case `SetSpaceGrant`.
   * @param {RemoveSpaceGrant} spaceGrantRemoval - Use case `RemoveSpaceGrant`.
   * @param {ListListGrants} listGrantListing - Use case `ListListGrants`.
   * @param {SetListGrant} listGrantChange - Use case `SetListGrant`.
   * @param {RemoveListGrant} listGrantRemoval - Use case `RemoveListGrant`.
   * @constructor
   */
  public constructor(
    @Inject(ListSpaceGrants) spaceGrantListing: ListSpaceGrants,
    @Inject(SetSpaceGrant) spaceGrantChange: SetSpaceGrant,
    @Inject(RemoveSpaceGrant) spaceGrantRemoval: RemoveSpaceGrant,
    @Inject(ListListGrants) listGrantListing: ListListGrants,
    @Inject(SetListGrant) listGrantChange: SetListGrant,
    @Inject(RemoveListGrant) listGrantRemoval: RemoveListGrant,
  ) {
    this.spaceGrantListing = spaceGrantListing;
    this.spaceGrantChange = spaceGrantChange;
    this.spaceGrantRemoval = spaceGrantRemoval;
    this.listGrantListing = listGrantListing;
    this.listGrantChange = listGrantChange;
    this.listGrantRemoval = listGrantRemoval;
  }
  // #endregion

  // #region Methods
  /**
   * Method listSpaceGrants
   *
   * @description
   * `GET /v1/spaces/{spaceId}/grants`: one page of the grants of a space.
   *
   * @param {z.output<typeof ListSpaceGrantsParams>} params - The path parameters.
   * @param {z.output<typeof ListSpaceGrantsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListSpaceGrantsResponse>>} The answer, mapped to the public contract.
   */
  @Get('spaces/:spaceId/grants')
  @CredentialGuard.requires({
    operationId: 'listSpaceGrants',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listSpaceGrants(
    @Param(new ZodValidationPipe(ListSpaceGrantsParams))
    params: z.output<typeof ListSpaceGrantsParams>,
    @Query(new ZodValidationPipe(ListSpaceGrantsQueryParams))
    query: z.output<typeof ListSpaceGrantsQueryParams>,
  ): Promise<z.output<typeof ListSpaceGrantsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listSpaceGrants',
      ListSpaceGrantsResponse,
      await relayProblems(LIST_SPACE_GRANTS_PROBLEMS, () =>
        this.spaceGrantListing.execute(params.spaceId, query),
      ),
    );
  }

  /**
   * Method setSpaceGrant
   *
   * @description
   * `PUT /v1/spaces/{spaceId}/grants/{userId}`: gives or changes the role of a person on a space,
   * with `If-Match` relayed unchanged. `200` with the grant and `ETag: "<version of the space>"`.
   *
   * @param {z.output<typeof SetSpaceGrantParams>} params - The path parameters.
   * @param {z.output<typeof SetSpaceGrantBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @param {Response} response - Response, for its `ETag`.
   * @returns {Promise<z.output<typeof SetSpaceGrantResponse>>} The answer, mapped to the public contract.
   */
  @Put('spaces/:spaceId/grants/:userId')
  @CredentialGuard.requires({
    operationId: 'setSpaceGrant',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async setSpaceGrant(
    @Param(new ZodValidationPipe(SetSpaceGrantParams)) params: z.output<typeof SetSpaceGrantParams>,
    @RequiredBody(SetSpaceGrantBody) body: z.output<typeof SetSpaceGrantBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SetSpaceGrantResponse>> {
    const changed: VersionedGrant = await relayProblems(SET_SPACE_GRANT_PROBLEMS, () =>
      this.spaceGrantChange.execute(params.spaceId, params.userId, body, ifMatch),
    );
    const grant: z.output<typeof SetSpaceGrantResponse> = conformBody(
      TASK_SERVICE,
      'setSpaceGrant',
      SetSpaceGrantResponse,
      changed.grant,
    );
    response.setHeader('ETag', formatEtag(changed.version));
    return grant;
  }

  /**
   * Method removeSpaceGrant
   *
   * @description
   * `DELETE /v1/spaces/{spaceId}/grants/{userId}`: removes the grant of a person on a space, with
   * `If-Match` relayed unchanged. `204` with `ETag: "<version of the space>"`.
   *
   * @param {z.output<typeof RemoveSpaceGrantParams>} params - The path parameters.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @param {Response} response - Response, for its `ETag`.
   * @returns {Promise<void>} Resolves once the grant is removed.
   */
  @Delete('spaces/:spaceId/grants/:userId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'removeSpaceGrant',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async removeSpaceGrant(
    @Param(new ZodValidationPipe(RemoveSpaceGrantParams))
    params: z.output<typeof RemoveSpaceGrantParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const version: number = await relayProblems(REMOVE_SPACE_GRANT_PROBLEMS, () =>
      this.spaceGrantRemoval.execute(params.spaceId, params.userId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(version));
  }

  /**
   * Method listListGrants
   *
   * @description
   * `GET /v1/lists/{listId}/grants`: one page of the grants of a list.
   *
   * @param {z.output<typeof ListListGrantsParams>} params - The path parameters.
   * @param {z.output<typeof ListListGrantsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListListGrantsResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId/grants')
  @CredentialGuard.requires({
    operationId: 'listListGrants',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listListGrants(
    @Param(new ZodValidationPipe(ListListGrantsParams))
    params: z.output<typeof ListListGrantsParams>,
    @Query(new ZodValidationPipe(ListListGrantsQueryParams))
    query: z.output<typeof ListListGrantsQueryParams>,
  ): Promise<z.output<typeof ListListGrantsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listListGrants',
      ListListGrantsResponse,
      await relayProblems(LIST_LIST_GRANTS_PROBLEMS, () =>
        this.listGrantListing.execute(params.listId, query),
      ),
    );
  }

  /**
   * Method setListGrant
   *
   * @description
   * `PUT /v1/lists/{listId}/grants/{userId}`: gives or changes the role of a person on a list,
   * with `If-Match` relayed unchanged. `200` with the grant and `ETag: "<version of the list>"`.
   *
   * @param {z.output<typeof SetListGrantParams>} params - The path parameters.
   * @param {z.output<typeof SetListGrantBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @param {Response} response - Response, for its `ETag`.
   * @returns {Promise<z.output<typeof SetListGrantResponse>>} The answer, mapped to the public contract.
   */
  @Put('lists/:listId/grants/:userId')
  @CredentialGuard.requires({
    operationId: 'setListGrant',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async setListGrant(
    @Param(new ZodValidationPipe(SetListGrantParams)) params: z.output<typeof SetListGrantParams>,
    @RequiredBody(SetListGrantBody) body: z.output<typeof SetListGrantBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SetListGrantResponse>> {
    const changed: VersionedGrant = await relayProblems(SET_LIST_GRANT_PROBLEMS, () =>
      this.listGrantChange.execute(params.listId, params.userId, body, ifMatch),
    );
    const grant: z.output<typeof SetListGrantResponse> = conformBody(
      TASK_SERVICE,
      'setListGrant',
      SetListGrantResponse,
      changed.grant,
    );
    response.setHeader('ETag', formatEtag(changed.version));
    return grant;
  }

  /**
   * Method removeListGrant
   *
   * @description
   * `DELETE /v1/lists/{listId}/grants/{userId}`: removes the grant of a person on a list, with
   * `If-Match` relayed unchanged. `204` with `ETag: "<version of the list>"`.
   *
   * @param {z.output<typeof RemoveListGrantParams>} params - The path parameters.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @param {Response} response - Response, for its `ETag`.
   * @returns {Promise<void>} Resolves once the grant is removed.
   */
  @Delete('lists/:listId/grants/:userId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'removeListGrant',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async removeListGrant(
    @Param(new ZodValidationPipe(RemoveListGrantParams))
    params: z.output<typeof RemoveListGrantParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const version: number = await relayProblems(REMOVE_LIST_GRANT_PROBLEMS, () =>
      this.listGrantRemoval.execute(params.listId, params.userId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(version));
  }
  // #endregion
}
