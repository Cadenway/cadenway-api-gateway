import type {
  MyOrganizationPage,
  Organization,
  OrganizationCreated,
  SessionOrganization,
} from '@cadenway/contracts/types/public/organizations';
import {
  CreateOrganizationBody,
  ListMyOrganizationsQueryParams,
  SwitchOrganizationBody,
  UpdateCurrentOrganizationBody,
} from '@cadenway/contracts/validators/public/organizations';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { sessionExpiredProblem } from '../../../../../../problems/session-problems.js';
import {
  isUpstreamProblem,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import {
  verifiedSessionOf,
  type RequestSession,
} from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateOrganization } from '../../../../application/use-cases/commands/organizations/create-organization/create-organization.use-case.js';
import { UpdateCurrentOrganization } from '../../../../application/use-cases/commands/organizations/update-current-organization/update-current-organization.use-case.js';
import { SwitchOrganization } from '../../../../application/use-cases/commands/sessions/switch-organization/switch-organization.use-case.js';
import { GetCurrentOrganization } from '../../../../application/use-cases/queries/organizations/get-current-organization/get-current-organization.use-case.js';
import { ListMyOrganizations } from '../../../../application/use-cases/queries/organizations/list-my-organizations/list-my-organizations.use-case.js';
import type { CreateOrganizationOutput } from '../../../../application/use-cases/commands/organizations/create-organization/create-organization.output.js';
import type { UpdateCurrentOrganizationInput } from '../../../../application/use-cases/commands/organizations/update-current-organization/update-current-organization.input.js';
import {
  toMyOrganizationPage,
  toOrganization,
  toOrganizationCreated,
  toSessionOrganization,
} from '../../mappers/organizations/organization.mapper.js';

/**
 * Constant INVALID_REQUEST
 *
 * @description
 * The `400` every route of this controller declares.
 *
 * @type {readonly string[]}
 */
const INVALID_REQUEST: readonly string[] = ['request.invalid'];

/**
 * Constant CREATE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `POST /v1/organizations` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const CREATE_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  404: ['user.not-synchronized'],
  409: ['organization.slug-taken'],
  422: ['organization.slug-invalid'],
};

/**
 * Constant LIST_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/organizations` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const LIST_PROBLEMS: AcceptedProblems = { 400: INVALID_REQUEST };

/**
 * Constant READ_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/organization` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const READ_PROBLEMS: AcceptedProblems = { 404: ['organization.not-found'] };

/**
 * Constant UPDATE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `PATCH /v1/organization` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
  409: ['organization.slug-taken'],
  412: ['request.version-mismatch'],
};

/**
 * Constant SWITCH_PROBLEMS
 *
 * @description
 * Client errors of identity-service that `PUT /v1/session/organization` answers as they are: an
 * organization whose authentication policy requires two-step verification for the role of the
 * caller, who has none (`403 organization.mfa-required`, `details.organizationId`; nothing
 * changes), and one the caller does not belong to, or not yet in the copy of the memberships.
 *
 * @type {AcceptedProblems}
 */
const SWITCH_PROBLEMS: AcceptedProblems = {
  400: INVALID_REQUEST,
  403: ['organization.mfa-required'],
  404: ['organization.not-found'],
};

/**
 * Constant LIST_QUERY
 *
 * @description
 * The query of `GET /v1/organizations` as the contract validates it; its generated validator
 * reads `limit` from its text.
 *
 * @type {z.ZodType<z.output<typeof ListMyOrganizationsQueryParams>>}
 */
const LIST_QUERY = ListMyOrganizationsQueryParams;

/**
 * Constant ORGANIZATION_LOCATION
 *
 * @description
 * `Location` of a created organization: where it reads once the session has chosen it.
 *
 * @type {string}
 */
const ORGANIZATION_LOCATION: string = '/v1/organization';

/**
 * Function toChanges
 *
 * @description
 * Maps the public JSON Merge Patch of the organization to its changes, member by member: a member
 * left out stays out, a `null` stays `null`.
 *
 * @param {z.output<typeof UpdateCurrentOrganizationBody>} body - The validated patch.
 * @returns {UpdateCurrentOrganizationInput['changes']} The changes.
 */
function toChanges(
  body: z.output<typeof UpdateCurrentOrganizationBody>,
): UpdateCurrentOrganizationInput['changes'] {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.slug === undefined ? {} : { slug: body.slug }),
    ...(body.description === undefined ? {} : { description: body.description }),
    ...(body.website === undefined ? {} : { website: body.website }),
    ...(body.defaultLanguage === undefined ? {} : { defaultLanguage: body.defaultLanguage }),
  };
}

/**
 * Class OrganizationsController
 *
 * @description
 * The routes of `openapi/public/organizations.yaml`: create an organization, list those of the
 * caller, read and change the current one, and choose the current organization of the session.
 * Every route accepts the session cookie only: `CredentialGuard` answers a personal API token
 * `403 auth.api-token-not-accepted`, and the routes on the current organization answer
 * `403 organization.not-selected` without one, before any call. `RateLimitGuard` counts the
 * session. The organization of a call is the one of the internal token, from the introspection,
 * never one the request names; organization-service decides every role rule.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class OrganizationsController {
  // #region Properties
  /**
   * Property creation
   *
   * @description
   * Creates an organization.
   *
   * @type {CreateOrganization}
   * @readonly
   */
  private readonly creation: CreateOrganization;

  /**
   * Property listing
   *
   * @description
   * Lists the organizations of the caller.
   *
   * @type {ListMyOrganizations}
   * @readonly
   */
  private readonly listing: ListMyOrganizations;

  /**
   * Property reading
   *
   * @description
   * Reads the current organization.
   *
   * @type {GetCurrentOrganization}
   * @readonly
   */
  private readonly reading: GetCurrentOrganization;

  /**
   * Property updating
   *
   * @description
   * Changes the current organization.
   *
   * @type {UpdateCurrentOrganization}
   * @readonly
   */
  private readonly updating: UpdateCurrentOrganization;

  /**
   * Property switching
   *
   * @description
   * Chooses the current organization of the session.
   *
   * @type {SwitchOrganization}
   * @readonly
   */
  private readonly switching: SwitchOrganization;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the organization routes.
   *
   * @param {CreateOrganization} creation - Creates an organization.
   * @param {ListMyOrganizations} listing - Lists the organizations of the caller.
   * @param {GetCurrentOrganization} reading - Reads the current organization.
   * @param {UpdateCurrentOrganization} updating - Changes the current organization.
   * @param {SwitchOrganization} switching - Chooses the current organization of the session.
   * @constructor
   */
  public constructor(
    @Inject(CreateOrganization) creation: CreateOrganization,
    @Inject(ListMyOrganizations) listing: ListMyOrganizations,
    @Inject(GetCurrentOrganization) reading: GetCurrentOrganization,
    @Inject(UpdateCurrentOrganization) updating: UpdateCurrentOrganization,
    @Inject(SwitchOrganization) switching: SwitchOrganization,
  ) {
    this.creation = creation;
    this.listing = listing;
    this.reading = reading;
    this.updating = updating;
    this.switching = switching;
  }
  // #endregion

  // #region Methods
  /**
   * Method createOrganization
   *
   * @description
   * `POST /v1/organizations`: an organization owned by the caller, with the invitations of
   * `inviteEmails`. `201` with `Location: /v1/organization` and the `ETag` of the organization.
   * The session does not move to it.
   *
   * @param {z.output<typeof CreateOrganizationBody>} body - Name, address, team size, use and
   * addresses.
   * @param {Response} response - Response, for `Location` and `ETag`.
   * @returns {Promise<OrganizationCreated>} The organization and the outcome of each address.
   */
  @Post('organizations')
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'createOrganization',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async createOrganization(
    @Body(new ZodValidationPipe(CreateOrganizationBody))
    body: z.output<typeof CreateOrganizationBody>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OrganizationCreated> {
    const created: CreateOrganizationOutput = await this.relay(CREATE_PROBLEMS, () =>
      this.creation.execute({
        name: body.name,
        ...(body.slug === undefined ? {} : { slug: body.slug }),
        teamSize: body.teamSize,
        primaryUse: body.primaryUse,
        inviteEmails: body.inviteEmails,
      }),
    );
    response.setHeader('Location', ORGANIZATION_LOCATION);
    response.setHeader('ETag', formatEtag(created.organization.version));
    return toOrganizationCreated(created);
  }

  /**
   * Method listMyOrganizations
   *
   * @description
   * `GET /v1/organizations`: the organizations of the caller, whatever the current one.
   *
   * @param {z.output<typeof LIST_QUERY>} query - Cursor and page size.
   * @returns {Promise<MyOrganizationPage>} One page of organizations.
   */
  @Get('organizations')
  @CredentialGuard.requires({
    operationId: 'listMyOrganizations',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async listMyOrganizations(
    @Query(new ZodValidationPipe(LIST_QUERY)) query: z.output<typeof LIST_QUERY>,
  ): Promise<MyOrganizationPage> {
    return toMyOrganizationPage(
      await this.relay(LIST_PROBLEMS, () =>
        this.listing.execute({
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          limit: query.limit,
        }),
      ),
    );
  }

  /**
   * Method getCurrentOrganization
   *
   * @description
   * `GET /v1/organization`: the current organization, with the role of the caller and its
   * `ETag`.
   *
   * @returns {Promise<Organization>} The organization.
   */
  @Get('organization')
  @CredentialGuard.requires({
    operationId: 'getCurrentOrganization',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async getCurrentOrganization(): Promise<Organization> {
    return toOrganization(await this.relay(READ_PROBLEMS, () => this.reading.execute()));
  }

  /**
   * Method updateCurrentOrganization
   *
   * @description
   * `PATCH /v1/organization`: a JSON Merge Patch of the current organization, with `If-Match`
   * relayed unchanged. An empty patch is answered `200` by organization-service without a change.
   *
   * @param {z.output<typeof UpdateCurrentOrganizationBody>} body - The patch.
   * @param {string | undefined} ifMatch - `If-Match` of the request.
   * @returns {Promise<Organization>} The organization after the change.
   */
  @Patch('organization')
  @CredentialGuard.requires({
    operationId: 'updateCurrentOrganization',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async updateCurrentOrganization(
    @Body(new ZodValidationPipe(UpdateCurrentOrganizationBody))
    body: z.output<typeof UpdateCurrentOrganizationBody>,
    @Headers('if-match') ifMatch: string | undefined,
  ): Promise<Organization> {
    return toOrganization(
      await this.relay(UPDATE_PROBLEMS, () =>
        this.updating.execute({ changes: toChanges(body), ifMatch }),
      ),
    );
  }

  /**
   * Method switchOrganization
   *
   * @description
   * `PUT /v1/session/organization`: makes an organization of the caller the current one of the
   * session of the cookie, answered by identity-service from its copy of the memberships. A
   * session that ended since its introspection (`404 session.not-found` of identity-service)
   * answers `401 auth.session-expired`.
   *
   * @param {z.output<typeof SwitchOrganizationBody>} body - The organization to act on.
   * @param {Request} request - Request, for its verified session.
   * @returns {Promise<SessionOrganization>} The organization and the role of the session.
   * @throws {Error} When the request carries no verified session: the guard did not run.
   */
  @Put('session/organization')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'switchOrganization',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async switchOrganization(
    @Body(new ZodValidationPipe(SwitchOrganizationBody))
    body: z.output<typeof SwitchOrganizationBody>,
    @Req() request: Request,
  ): Promise<SessionOrganization> {
    const session: RequestSession | undefined = verifiedSessionOf(request);
    if (session === undefined) {
      throw new Error('PUT /v1/session/organization ran without a verified session.');
    }
    try {
      return toSessionOrganization(
        await this.switching.execute({
          sessionId: session.sessionId,
          organizationId: body.organizationId,
        }),
      );
    } catch (error) {
      if (isUpstreamProblem(error, 404, 'session.not-found')) {
        throw sessionExpiredProblem();
      }
      throw toPublicProblem(error, SWITCH_PROBLEMS);
    }
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
