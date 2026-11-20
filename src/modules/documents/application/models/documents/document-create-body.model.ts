/** Document source for creation. */
export interface DocumentCreateBody {
  // #region Properties
  /** Target space. */
  readonly spaceId: string;

  /** Document title. */
  readonly title: string;

  /** Optional initial Markdown. */
  readonly body?: string | undefined;
  // #endregion
}
