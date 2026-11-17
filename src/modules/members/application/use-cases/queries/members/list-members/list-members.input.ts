/**
 * Interface ListMembersInput
 *
 * @description
 * The page and the filters of a member list.
 */
export interface ListMembersInput {
  // #region Properties
  /**
   * Property cursor
   *
   * @description
   * Cursor of the previous page's `nextCursor`.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly cursor?: string;

  /**
   * Property limit
   *
   * @description
   * Page size, 1 to 100.
   *
   * @type {number}
   * @readonly
   */
  readonly limit: number;

  /**
   * Property search
   *
   * @description
   * Text to find in the name or the address.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly search?: string;

  /**
   * Property roles
   *
   * @description
   * Roles to keep; every role when absent.
   *
   * @type {readonly ('owner' | 'admin' | 'member' | 'guest')[] | undefined}
   * @readonly
   */
  readonly roles?: readonly ('owner' | 'admin' | 'member' | 'guest')[];
  // #endregion
}
