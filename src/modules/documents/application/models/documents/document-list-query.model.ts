/** Public list options forwarded to Document. */
export interface DocumentListQuery {
  // #region Properties
  /** Search text. */
  readonly q?: string | undefined;

  /** Previous page cursor. */
  readonly cursor?: string | undefined;

  /** Maximum results. */
  readonly limit: number;
  // #endregion
}
