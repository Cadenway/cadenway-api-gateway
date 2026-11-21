/** Search parameters validated at the public HTTP boundary. */
export interface SearchQuery {
  // #region Properties
  /** Literal query forwarded to Search. */
  readonly q: string;

  /** Opaque continuation, if supplied. */
  readonly cursor?: string;

  /** Requested page size. */
  readonly limit: number;
  // #endregion
}
