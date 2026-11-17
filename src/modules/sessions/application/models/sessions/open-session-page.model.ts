import type { OpenSession } from './open-session.model.js';

/**
 * Interface OpenSessionPage
 *
 * @description
 * One page of the open sessions of the account of the request.
 */
export interface OpenSessionPage {
  // #region Properties
  /**
   * Property items
   *
   * @description
   * The sessions of the page, by sign-in, the most recent first.
   *
   * @type {readonly OpenSession[]}
   * @readonly
   */
  readonly items: readonly OpenSession[];

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
