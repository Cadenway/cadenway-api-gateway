import type { Member } from '../../../../models/members/member.model.js';
import type { MemberDirectory } from '../../../../ports/outbound/organization-service/members/member-directory.port.js';

/**
 * Class GetMember
 *
 * @description
 * Reads one member of the current organization through organization-service.
 */
export class GetMember {
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
   * Reads the member of the organization of the context.
   *
   * @param {string} memberId - Id of the membership.
   * @returns {Promise<Member>} The member.
   */
  public execute(memberId: string): Promise<Member> {
    return this.directory.getMember(memberId);
  }
  // #endregion
}
