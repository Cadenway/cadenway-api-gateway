/** Source fields supplied to a document edit. */
export interface DocumentUpdateBody {
  // #region Properties
  /** New title. */
  readonly title?: string | undefined;

  /** New Markdown. */
  readonly body?: string | undefined;
  // #endregion
}
