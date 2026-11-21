import type { Member, MemberPage } from '@cadenway/contracts/types/public/members';
import {
  ChangeMemberRoleBody,
  GetMemberParams,
  ListMembersQueryParams,
} from '@cadenway/contracts/validators/public/members';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { toQueryList } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ChangeMemberRole } from '../../../../application/use-cases/commands/members/change-member-role/change-member-role.use-case.js';
import { RemoveMember } from '../../../../application/use-cases/commands/members/remove-member/remove-member.use-case.js';
import { GetMember } from '../../../../application/use-cases/queries/members/get-member/get-member.use-case.js';
import { ListMembers } from '../../../../application/use-cases/queries/members/list-members/list-members.use-case.js';
import { toMember, toMemberPage } from '../../mappers/members/member.mapper.js';

/**
 * Constant LIST_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/members` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const LIST_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
};

/**
 * Constant READ_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `GET /v1/members/{memberId}` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const READ_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['member.not-found'],
};

/**
 * Constant CHANGE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `PATCH /v1/members/{memberId}` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const CHANGE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['member.not-found'],
  409: ['organization.seat-quota-exceeded'],
  412: ['request.version-mismatch'],
  422: ['member.owner-protected'],
};

/**
 * Constant REMOVE_PROBLEMS
 *
 * @description
 * Client errors of organization-service that `DELETE /v1/members/{memberId}` answers as they are.
 *
 * @type {AcceptedProblems}
 */
const REMOVE_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['member.not-found'],
  422: ['member.owner-protected'],
};

/**
 * Constant MEMBER_ALIASES
 *
 * @description
 * On a route about one member, the caller who no longer belongs to the organization
 * (`404 organization.not-found` of organization-service) gets the `404 member.not-found` the
 * public operation declares.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MEMBER_ALIASES: Readonly<Record<string, string>> = {
  'organization.not-found': 'member.not-found',
};

/**
 * Constant LIST_QUERY
 *
 * @description
 * The query of `GET /v1/members` as the contract validates it, with `role` split on its commas
 * first; the generated validator reads `limit` from its text.
 *
 * @type {z.ZodType<z.output<typeof ListMembersQueryParams>>}
 */
const LIST_QUERY = ListMembersQueryParams.extend({
  role: z.preprocess(toQueryList, ListMembersQueryParams.shape.role),
});

/**
 * Class MembersController
 *
 * @description
 * The member routes of `openapi/public/members.yaml`, on the current organization: list and read
 * the members (the session cookie, or a personal API token with `members:read`), change a role
 * and remove a member (the session cookie only). `CredentialGuard` answers
 * `403 auth.scope-missing`, `403 auth.api-token-not-accepted` and
 * `403 organization.not-selected` before any call; `RateLimitGuard` counts the session or the
 * token. organization-service decides every role rule (a guest does not read the list, nobody
 * changes or removes the owner) and answers a member of another organization `404`.
 */
@Controller('v1/members')
@UseGuards(CredentialGuard, RateLimitGuard)
export class MembersController {
  // #region Properties
  /**
   * Property listing
   *
   * @description
   * Lists the members.
   *
   * @type {ListMembers}
   * @readonly
   */
  private readonly listing: ListMembers;

  /**
   * Property reading
   *
   * @description
   * Reads a member.
   *
   * @type {GetMember}
   * @readonly
   */
  private readonly reading: GetMember;

  /**
   * Property roleChange
   *
   * @description
   * Changes the role of a member.
   *
   * @type {ChangeMemberRole}
   * @readonly
   */
  private readonly roleChange: ChangeMemberRole;

  /**
   * Property removal
   *
   * @description
   * Removes a member.
   *
   * @type {RemoveMember}
   * @readonly
   */
  private readonly removal: RemoveMember;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the member routes.
   *
   * @param {ListMembers} listing - Lists the members.
   * @param {GetMember} reading - Reads a member.
   * @param {ChangeMemberRole} roleChange - Changes the role of a member.
   * @param {RemoveMember} removal - Removes a member.
   * @constructor
   */
  public constructor(
    @Inject(ListMembers) listing: ListMembers,
    @Inject(GetMember) reading: GetMember,
    @Inject(ChangeMemberRole) roleChange: ChangeMemberRole,
    @Inject(RemoveMember) removal: RemoveMember,
  ) {
    this.listing = listing;
    this.reading = reading;
    this.roleChange = roleChange;
    this.removal = removal;
  }
  // #endregion

  // #region Methods
  /**
   * Method listMembers
   *
   * @description
   * `GET /v1/members`: one page of the members, sorted by name, with `total` for the filters and
   * `counts` for the whole organization.
   *
   * @param {z.output<typeof LIST_QUERY>} query - Cursor, page size, search and roles.
   * @returns {Promise<MemberPage>} One page of members.
   */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listMembers',
    security: [{ sessionCookie: [] }, { apiToken: ['members:read'] }],
    organization: true,
  })
  public async listMembers(
    @Query(new ZodValidationPipe(LIST_QUERY)) query: z.output<typeof LIST_QUERY>,
  ): Promise<MemberPage> {
    return toMemberPage(
      await this.relay(LIST_PROBLEMS, {}, () =>
        this.listing.execute({
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          limit: query.limit,
          ...(query.search === undefined ? {} : { search: query.search }),
          ...(query.role === undefined ? {} : { roles: query.role }),
        }),
      ),
    );
  }

  /**
   * Method getMember
   *
   * @description
   * `GET /v1/members/{memberId}`: one member, with its `ETag`.
   *
   * @param {z.output<typeof GetMemberParams>} params - The id of the membership.
   * @returns {Promise<Member>} The member.
   */
  @Get(':memberId')
  @CredentialGuard.requires({
    operationId: 'getMember',
    security: [{ sessionCookie: [] }, { apiToken: ['members:read'] }],
    organization: true,
  })
  public async getMember(
    @Param(new ZodValidationPipe(GetMemberParams)) params: z.output<typeof GetMemberParams>,
  ): Promise<Member> {
    return toMember(
      await this.relay(READ_PROBLEMS, MEMBER_ALIASES, () => this.reading.execute(params.memberId)),
    );
  }

  /**
   * Method changeMemberRole
   *
   * @description
   * `PATCH /v1/members/{memberId}`: gives the member another role, with `If-Match` relayed
   * unchanged. `role: owner` is refused by the contract with `400 request.invalid`.
   *
   * @param {z.output<typeof GetMemberParams>} params - The id of the membership.
   * @param {z.output<typeof ChangeMemberRoleBody>} body - The new role.
   * @param {string | undefined} ifMatch - `If-Match` of the request.
   * @returns {Promise<Member>} The member with its role.
   */
  @Patch(':memberId')
  @CredentialGuard.requires({
    operationId: 'changeMemberRole',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async changeMemberRole(
    @Param(new ZodValidationPipe(GetMemberParams)) params: z.output<typeof GetMemberParams>,
    @Body(new ZodValidationPipe(ChangeMemberRoleBody)) body: z.output<typeof ChangeMemberRoleBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<Member> {
    return toMember(
      await this.relay(CHANGE_PROBLEMS, MEMBER_ALIASES, () =>
        this.roleChange.execute({ memberId: params.memberId, role: body.role, ifMatch }),
      ),
    );
  }

  /**
   * Method removeMember
   *
   * @description
   * `DELETE /v1/members/{memberId}`: removes the member. `204`.
   *
   * @param {z.output<typeof GetMemberParams>} params - The id of the membership.
   * @returns {Promise<void>} Resolves once the member is removed.
   */
  @Delete(':memberId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'removeMember',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async removeMember(
    @Param(new ZodValidationPipe(GetMemberParams)) params: z.output<typeof GetMemberParams>,
  ): Promise<void> {
    await this.relay(REMOVE_PROBLEMS, MEMBER_ALIASES, () => this.removal.execute(params.memberId));
  }

  /**
   * Method relay
   *
   * @description
   * Runs a use case and translates its failure into the public problem of the route (see
   * `toPublicProblem`).
   *
   * @param {AcceptedProblems} accepted - Client errors the public operation declares.
   * @param {Readonly<Record<string, string>>} aliases - Public code of an internal code.
   * @param {() => Promise<TResult>} call - The use case.
   * @returns {Promise<TResult>} What the use case resolved with.
   */
  private async relay<TResult>(
    accepted: AcceptedProblems,
    aliases: Readonly<Record<string, string>>,
    call: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await call();
    } catch (error) {
      throw toPublicProblem(error, accepted, aliases);
    }
  }
  // #endregion
}
