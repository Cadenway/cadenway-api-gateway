import type { MemberDirectory } from '../../../../ports/outbound/organization-service/members/member-directory.port.js';

/**
 * Class RemoveMember
 *
 * @description
 * Removes a member from the current organization through organization-service, which decides who may and protects the owner.
 */
export class RemoveMember {
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
   * Removes the member.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<void>} Resolves once the member is removed.
   */
  public execute(memberId: string): Promise<void> {
    return this.directory.removeMember(memberId);
  }
  // #endregion
}
