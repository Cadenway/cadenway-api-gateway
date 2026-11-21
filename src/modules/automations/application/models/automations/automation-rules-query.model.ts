/** Bounds one page of rules or execution candidates. */
export interface AutomationRulesQuery {
  // #region Properties
  /** Opaque continuation from the preceding page. */
  readonly cursor?: string | undefined;

  /** Maximum number of items the upstream page can contain. */
  readonly limit: number;
  // #endregion
}
