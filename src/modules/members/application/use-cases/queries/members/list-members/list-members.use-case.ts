import type { ListMembersInput } from './list-members.input.js';
import type { MemberPage } from '../../../../models/members/member-page.model.js';
import type { MemberDirectory } from '../../../../ports/outbound/organization-service/members/member-directory.port.js';

/**
 * Class ListMembers
 *
 * @description
 * Lists the members of the current organization through organization-service, which refuses a guest.
 */
export class ListMembers {
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
   * Reads one page of the members of the organization of the context.
   *
   * @param {ListMembersInput} input - The page and the filters.
   * @returns {Promise<MemberPage>} One page of members, with the totals.
   */
  public execute(input: ListMembersInput, method?: 'QUERY'): Promise<MemberPage> {
    return method === 'QUERY'
      ? this.directory.listMembers(input, method)
      : this.directory.listMembers(input);
  }
  // #endregion
}
