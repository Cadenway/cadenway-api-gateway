/** A provider delivery selected by its opaque receiver binding. */
export interface GitHubWebhookDelivery {
  // #region Properties
  /** The configured receiver identifier. */
  readonly bindingId: string;

  /** The provider delivery identifier. */
  readonly delivery: string;

  /** The event header, interpreted by Integration. */
  readonly event: string;

  /** Provider signature, verified by Integration. */
  readonly signature: string;

  /** Original JSON bytes without parsing. */
  readonly body: Buffer;
  // #endregion
}
