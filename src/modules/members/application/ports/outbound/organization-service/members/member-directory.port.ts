import type { ListMembersInput } from '../../../../use-cases/queries/members/list-members/list-members.input.js';
import type { Member } from '../../../../models/members/member.model.js';
import type { MemberPage } from '../../../../models/members/member-page.model.js';

/**
 * Interface MemberDirectory
 *
 * @description
 * Outgoing port of the member routes: the members of organization-service, called as the user of
 * the current organization context, in the organization of its internal token. organization-service
 * decides every role rule and answers a member of another organization `404`.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of organization-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface MemberDirectory {
  // #region Methods
  /**
   * Method listMembers
   *
   * @description
   * `GET /internal/v1/members`.
   *
   * @param {ListMembersInput} query - The page and the filters.
   * @returns {Promise<MemberPage>} One page of members, with the totals.
   */
  listMembers(query: ListMembersInput, method?: 'QUERY'): Promise<MemberPage>;

  /**
   * Method getMember
   *
   * @description
   * `GET /internal/v1/members/{memberId}`.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<Member>} The member.
   */
  getMember(memberId: string): Promise<Member>;

  /**
   * Method changeMemberRole
   *
   * @description
   * `PATCH /internal/v1/members/{memberId}`, with the `If-Match` of the public request.
   *
   * @param {string} memberId - Id of the membership.
   * @param {'admin' | 'member' | 'guest'} role - The role to give.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<Member>} The member with its role.
   */
  changeMemberRole(
    memberId: string,
    role: 'admin' | 'member' | 'guest',
    ifMatch: string | undefined,
  ): Promise<Member>;

  /**
   * Method removeMember
   *
   * @description
   * `DELETE /internal/v1/members/{memberId}`.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<void>} Resolves once the member is removed.
   */
  removeMember(memberId: string): Promise<void>;
  // #endregion
}
