import type { Member } from './member.model.js';
import type { RoleCounts } from './role-counts.model.js';

/**
 * Interface MemberPage
 *
 * @description
 * One page of the members of the current organization, with its totals.
 */
export interface MemberPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The members of the page, sorted by name.
   *
   * @type {readonly Member[]}
   * @readonly
   */
  readonly items: readonly Member[];

  /**
   * Property nextCursor
   *
   * @description
   * Cursor of the next page; `null` on the last page.
   *
   * @type {string | null}
   * @readonly
   */
  readonly nextCursor: string | null;

  /**
   * Property total
   *
   * @description
   * Members that match the search and the roles, on every page.
   *
   * @type {number}
   * @readonly
   */
  readonly total: number;

  /**
   * Property counts
   *
   * @description
   * Members by role, whatever the filters.
   *
   * @type {RoleCounts}
   * @readonly
   */
  readonly counts: RoleCounts;
  // #endregion
}
