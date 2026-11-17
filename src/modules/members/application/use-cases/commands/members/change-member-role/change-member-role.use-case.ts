import type { ChangeMemberRoleInput } from './change-member-role.input.js';
import type { Member } from '../../../../models/members/member.model.js';
import type { MemberDirectory } from '../../../../ports/outbound/organization-service/members/member-directory.port.js';

/**
 * Class ChangeMemberRole
 *
 * @description
 * Gives a member another role through organization-service, which decides who may and protects the owner.
 */
export class ChangeMemberRole {
  // #region Properties
  /**
   * Property directory
   *
   * @description
   * The members of organization-service.
   *
   * @type {MemberDirectory}
   * @readonly
   */
  private readonly directory: MemberDirectory;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {MemberDirectory} directory - The members of organization-service.
   * @constructor
   */
  public constructor(directory: MemberDirectory) {
    this.directory = directory;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Changes the role of the member.
   *
   * @param {ChangeMemberRoleInput} input - The member, its new role and `If-Match`.
   * @returns {Promise<Member>} The member with its role.
   */
  public execute(input: ChangeMemberRoleInput): Promise<Member> {
    return this.directory.changeMemberRole(input.memberId, input.role, input.ifMatch);
  }
  // #endregion
}
