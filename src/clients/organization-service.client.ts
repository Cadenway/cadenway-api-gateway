import type {
  Invitation,
  InvitationBatch,
  InvitationBatchResult,
  InvitationPage,
  ListInvitationsInternalParams,
  ListMembersInternalParams,
  ListMyOrganizationsInternalParams,
  ListReceivedInvitationsInternalParams,
  Member,
  MemberPage,
  MemberPatch,
  MyOrganization,
  MyOrganizationPage,
  Organization,
  OrganizationCreated,
  OrganizationCreation,
  OrganizationPatch,
  ReceivedInvitationPage,
} from '@cadenway/contracts/types/internal/organization-service';
import {
  AcceptInvitationInternalResponse,
  ChangeMemberRoleInternalResponse,
  CreateOrganizationInternalResponse,
  GetMemberInternalResponse,
  GetOrganizationInternalResponse,
  InviteMembersInternalResponse,
  ListInvitationsInternalResponse,
  ListMembersInternalResponse,
  ListMyOrganizationsInternalResponse,
  ListReceivedInvitationsInternalResponse,
  ResendInvitationInternalResponse,
  UpdateOrganizationInternalResponse,
} from '@cadenway/contracts/validators/internal/organization-service';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import type { z } from 'zod';

import {
  answered as answeredBy,
  expectBody as expectBodyOf,
  expectStatus as expectStatusOf,
  type GeneratedResponse,
} from '../problems/upstream-answer.js';
import { getOrganizationServiceInternalRoutes } from './generated/organization-service.js';

/**
 * Constant ORGANIZATION_SERVICE
 *
 * @description
 * Name of organization-service: the `aud` of the internal tokens of its calls, the name of its
 * circuit breaker and the `details.service` of the problems its calls raise.
 *
 * @type {string}
 */
export const ORGANIZATION_SERVICE: string = 'organization-service';

/**
 * Type OrganizationServiceRoutes
 *
 * @description
 * The functions orval generated from `openapi/internal/organization-service.yaml`.
 *
 * @type {ReturnType<typeof getOrganizationServiceInternalRoutes>}
 */
type OrganizationServiceRoutes = ReturnType<typeof getOrganizationServiceInternalRoutes>;

/**
 * Constant EMPTY_REQUEST
 *
 * @description
 * The empty object the action routes carry as their body (`EmptyRequest` of the contract).
 *
 * @type {Readonly<Record<string, never>>}
 */
const EMPTY_REQUEST: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Function expectStatus
 *
 * @description
 * Checks that a response of organization-service has the success status of its operation.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {number} status - Success status of the operation.
 * @throws {ProblemException} 503 `upstream.failed` for another status.
 */
function expectStatus(operation: string, response: GeneratedResponse, status: number): void {
  expectStatusOf(ORGANIZATION_SERVICE, operation, response, status);
}

/**
 * Function expectBody
 *
 * @description
 * Checks a response of organization-service against its operation: the success status, then the
 * body against the zod validator of `@cadenway/contracts`, keeping the members of the contract
 * only.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedResponse} response - Response of the generated function.
 * @param {number} status - Success status of the operation.
 * @param {TSchema} schema - Validator of the success body.
 * @returns {z.output<TSchema>} The validated body.
 * @throws {ProblemException} 503 `upstream.failed` when the status or the body does not match.
 */
function expectBody<TSchema extends z.ZodType>(
  operation: string,
  response: GeneratedResponse,
  status: number,
  schema: TSchema,
): z.output<TSchema> {
  return expectBodyOf(ORGANIZATION_SERVICE, operation, response, status, schema);
}

/**
 * Function answered
 *
 * @description
 * Awaits a generated call of organization-service: a body that is not JSON becomes
 * `503 upstream.failed` without being quoted.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {Promise<TResponse>} call - The generated call.
 * @returns {Promise<TResponse>} What the call resolved with.
 * @throws {ProblemException} 503 `upstream.failed` for a body that is not JSON.
 */
function answered<TResponse>(operation: string, call: Promise<TResponse>): Promise<TResponse> {
  return answeredBy(ORGANIZATION_SERVICE, operation, call);
}

/**
 * Function ifMatchHeader
 *
 * @description
 * The request options that relay the `If-Match` of the public request unchanged, or none.
 *
 * @param {string | undefined} ifMatch - `If-Match` of the public request.
 * @returns {RequestInit} The options of the generated call.
 */
function ifMatchHeader(ifMatch: string | undefined): RequestInit {
  return ifMatch === undefined ? {} : { headers: { 'If-Match': ifMatch } };
}

/**
 * Class OrganizationServiceClient
 *
 * @description
 * Outgoing adapter of organization-service: the functions generated from
 * `openapi/internal/organization-service.yaml`, called through one `InternalHttpClient` of
 * `@cadenway/nest-common`, behind the ports of the organization, member and invitation routes.
 *
 * - Every call carries an internal token signed by the gateway with
 *   `aud: organization-service`, for the user of the current organization context: the
 *   organization, role and scopes the introspection of the request returned. organization-service
 *   decides every role rule from its own members, never from that role.
 * - The internal HTTP client gives each call the time left to the request (2 seconds at most), one
 *   retry after a connection error or a `503` for an idempotent call (`GET`, and `DELETE` but the
 *   removal of a member; the `POST` and `PATCH` calls are not retried), and the circuit breaker of
 *   organization-service. It throws
 *   its problems: a relayed client error, or `503 upstream.*`.
 * - Every success is checked against the internal contract before it is returned; a mismatch is
 *   `503 upstream.failed`.
 */
export class OrganizationServiceClient {
  // #region Properties
  /**
   * Property routes
   *
   * @description
   * The generated functions, bound to the `fetch` of the internal HTTP client.
   *
   * @type {OrganizationServiceRoutes}
   * @readonly
   */
  private readonly routes: OrganizationServiceRoutes;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the generated functions to the internal HTTP client of organization-service, which
   * resolves the generated paths (`/internal/v1/...`) against `ORGANIZATION_SERVICE_URL`.
   *
   * @param {InternalHttpClient} http - Internal HTTP client built for organization-service.
   * @constructor
   */
  public constructor(http: InternalHttpClient) {
    this.routes = getOrganizationServiceInternalRoutes(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (typeof input !== 'string') {
          throw new Error('The generated organization-service client passes a path.');
        }
        return http.fetch(input, init);
      },
    );
  }
  // #endregion

  // #region Methods
  /**
   * Method createOrganization
   *
   * @description
   * `POST /internal/v1/organizations`: an organization owned by the user, with its invitations.
   *
   * @param {OrganizationCreation} creation - Name, address, team size, use and addresses.
   * @returns {Promise<OrganizationCreated>} The organization and the outcome of each address.
   */
  public async createOrganization(creation: OrganizationCreation): Promise<OrganizationCreated> {
    return expectBody(
      'createOrganizationInternal',
      await answered(
        'createOrganizationInternal',
        this.routes.createOrganizationInternal(creation),
      ),
      201,
      CreateOrganizationInternalResponse,
    );
  }

  /**
   * Method listMyOrganizations
   *
   * @description
   * `GET /internal/v1/organizations`: the organizations of the user.
   *
   * @param {ListMyOrganizationsInternalParams} page - Cursor and page size.
   * @returns {Promise<MyOrganizationPage>} One page of organizations.
   */
  public async listMyOrganizations(
    page: ListMyOrganizationsInternalParams,
  ): Promise<MyOrganizationPage> {
    return expectBody(
      'listMyOrganizationsInternal',
      await answered('listMyOrganizationsInternal', this.routes.listMyOrganizationsInternal(page)),
      200,
      ListMyOrganizationsInternalResponse,
    );
  }

  /**
   * Method getOrganization
   *
   * @description
   * `GET /internal/v1/organization`: the organization of the context.
   *
   * @returns {Promise<Organization>} The organization, with the role of the user in it.
   */
  public async getOrganization(): Promise<Organization> {
    return expectBody(
      'getOrganizationInternal',
      await answered('getOrganizationInternal', this.routes.getOrganizationInternal()),
      200,
      GetOrganizationInternalResponse,
    );
  }

  /**
   * Method updateOrganization
   *
   * @description
   * `PATCH /internal/v1/organization`, with the `If-Match` of the public request relayed.
   *
   * @param {OrganizationPatch} patch - JSON Merge Patch of the organization.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<Organization>} The organization after the change.
   */
  public async updateOrganization(
    patch: OrganizationPatch,
    ifMatch: string | undefined,
  ): Promise<Organization> {
    return expectBody(
      'updateOrganizationInternal',
      await answered(
        'updateOrganizationInternal',
        this.routes.updateOrganizationInternal(patch, ifMatchHeader(ifMatch)),
      ),
      200,
      UpdateOrganizationInternalResponse,
    );
  }

  /**
   * Method listMembers
   *
   * @description
   * `GET /internal/v1/members`: the members of the organization of the context.
   *
   * @param {ListMembersInternalParams} query - Cursor, page size, search and roles.
   * @returns {Promise<MemberPage>} One page of members, with the totals.
   */
  public async listMembers(query: ListMembersInternalParams): Promise<MemberPage> {
    return expectBody(
      'listMembersInternal',
      await answered('listMembersInternal', this.routes.listMembersInternal(query)),
      200,
      ListMembersInternalResponse,
    );
  }

  /**
   * Method getMember
   *
   * @description
   * `GET /internal/v1/members/{memberId}`.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<Member>} The member.
   */
  public async getMember(memberId: string): Promise<Member> {
    return expectBody(
      'getMemberInternal',
      await answered('getMemberInternal', this.routes.getMemberInternal(memberId)),
      200,
      GetMemberInternalResponse,
    );
  }

  /**
   * Method changeMemberRole
   *
   * @description
   * `PATCH /internal/v1/members/{memberId}`, with the `If-Match` of the public request relayed.
   *
   * @param {string} memberId - Id of the membership.
   * @param {MemberPatch} patch - The new role.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<Member>} The member with its role.
   */
  public async changeMemberRole(
    memberId: string,
    patch: MemberPatch,
    ifMatch: string | undefined,
  ): Promise<Member> {
    return expectBody(
      'changeMemberRoleInternal',
      await answered(
        'changeMemberRoleInternal',
        this.routes.changeMemberRoleInternal(memberId, patch, ifMatchHeader(ifMatch)),
      ),
      200,
      ChangeMemberRoleInternalResponse,
    );
  }

  /**
   * Method removeMember
   *
   * @description
   * `DELETE /internal/v1/members/{memberId}`, never retried: unlike the other `DELETE` calls, a
   * second removal answers `404 member.not-found` in the contract, so a retry after a removal
   * that succeeded would turn it into an error.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<void>} Resolves once the member is removed.
   */
  public async removeMember(memberId: string): Promise<void> {
    const options: InternalRequestInit = { idempotent: false };
    expectStatus(
      'removeMemberInternal',
      await answered('removeMemberInternal', this.routes.removeMemberInternal(memberId, options)),
      204,
    );
  }

  /**
   * Method inviteMembers
   *
   * @description
   * `POST /internal/v1/invitations`.
   *
   * @param {InvitationBatch} batch - Addresses and their role.
   * @returns {Promise<InvitationBatchResult>} The outcome of each distinct address.
   */
  public async inviteMembers(batch: InvitationBatch): Promise<InvitationBatchResult> {
    return expectBody(
      'inviteMembersInternal',
      await answered('inviteMembersInternal', this.routes.inviteMembersInternal(batch)),
      200,
      InviteMembersInternalResponse,
    );
  }

  /**
   * Method listInvitations
   *
   * @description
   * `GET /internal/v1/invitations`: the pending invitations of the organization of the context.
   *
   * @param {ListInvitationsInternalParams} page - Cursor and page size.
   * @returns {Promise<InvitationPage>} One page of invitations, with their total.
   */
  public async listInvitations(page: ListInvitationsInternalParams): Promise<InvitationPage> {
    return expectBody(
      'listInvitationsInternal',
      await answered('listInvitationsInternal', this.routes.listInvitationsInternal(page)),
      200,
      ListInvitationsInternalResponse,
    );
  }

  /**
   * Method revokeInvitation
   *
   * @description
   * `DELETE /internal/v1/invitations/{invitationId}`.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is revoked, or was already.
   */
  public async revokeInvitation(invitationId: string): Promise<void> {
    expectStatus(
      'revokeInvitationInternal',
      await answered(
        'revokeInvitationInternal',
        this.routes.revokeInvitationInternal(invitationId),
      ),
      204,
    );
  }

  /**
   * Method resendInvitation
   *
   * @description
   * `POST /internal/v1/invitations/{invitationId}/resend`.
   *
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<Invitation>} The invitation, with its new expiry.
   */
  public async resendInvitation(invitationId: string): Promise<Invitation> {
    return expectBody(
      'resendInvitationInternal',
      await answered(
        'resendInvitationInternal',
        this.routes.resendInvitationInternal(invitationId, EMPTY_REQUEST),
      ),
      200,
      ResendInvitationInternalResponse,
    );
  }

  /**
   * Method listReceivedInvitations
   *
   * @description
   * `GET /internal/v1/users/{userId}/invitations`.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {ListReceivedInvitationsInternalParams} page - Cursor and page size.
   * @returns {Promise<ReceivedInvitationPage>} One page of invitations addressed to the user.
   */
  public async listReceivedInvitations(
    userId: string,
    page: ListReceivedInvitationsInternalParams,
  ): Promise<ReceivedInvitationPage> {
    return expectBody(
      'listReceivedInvitationsInternal',
      await answered(
        'listReceivedInvitationsInternal',
        this.routes.listReceivedInvitationsInternal(userId, page),
      ),
      200,
      ListReceivedInvitationsInternalResponse,
    );
  }

  /**
   * Method acceptInvitation
   *
   * @description
   * `POST /internal/v1/users/{userId}/invitations/{invitationId}/accept`.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<MyOrganization>} The organization joined.
   */
  public async acceptInvitation(userId: string, invitationId: string): Promise<MyOrganization> {
    return expectBody(
      'acceptInvitationInternal',
      await answered(
        'acceptInvitationInternal',
        this.routes.acceptInvitationInternal(userId, invitationId, EMPTY_REQUEST),
      ),
      200,
      AcceptInvitationInternalResponse,
    );
  }

  /**
   * Method refuseInvitation
   *
   * @description
   * `POST /internal/v1/users/{userId}/invitations/{invitationId}/refuse`.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {string} invitationId - Id of the invitation.
   * @returns {Promise<void>} Resolves once the invitation is refused.
   */
  public async refuseInvitation(userId: string, invitationId: string): Promise<void> {
    expectStatus(
      'refuseInvitationInternal',
      await answered(
        'refuseInvitationInternal',
        this.routes.refuseInvitationInternal(userId, invitationId, EMPTY_REQUEST),
      ),
      204,
    );
  }
  // #endregion
}
