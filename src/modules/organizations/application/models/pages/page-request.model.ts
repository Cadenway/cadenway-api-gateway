/**
 * Interface PageRequest
 *
 * @description
 * The page of a list the caller asks for.
 */
export interface PageRequest {
  // #region Properties
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
