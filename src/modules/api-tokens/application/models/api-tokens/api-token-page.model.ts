import type { ApiToken } from './api-token.model.js';

/**
 * Interface ApiTokenPage
 *
 * @description
 * One page of the active personal API tokens of the caller in the current organization.
 */
export interface ApiTokenPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The tokens of the page, the most recently created first.
   *
   * @type {readonly ApiToken[]}
   * @readonly
   */
  readonly items: readonly ApiToken[];

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
  // #endregion
}
