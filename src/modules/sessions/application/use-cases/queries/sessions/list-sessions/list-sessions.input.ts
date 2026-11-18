/**
 * Interface ListSessionsInput
 *
 * @description
 * A page of the open sessions of the account of the verified session.
 */
export interface ListSessionsInput {
  // #region Properties
  /**
   * Property userId
   *
   * @description
   * Id of the account, as the introspection of the session returned it.
   *
   * @type {string}
   * @readonly
   */
  readonly userId: string;

  /**
   * Property currentSessionId
   *
   * @description
   * Id of the session of the request, which identity-service marks `current`.
   *
   * @type {string}
   * @readonly
   */
  readonly currentSessionId: string;

  /**
   * Property cursor
   *
   * @description
   * Opaque cursor of the previous page's `nextCursor`; the first page without one.
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
  // #endregion
}
