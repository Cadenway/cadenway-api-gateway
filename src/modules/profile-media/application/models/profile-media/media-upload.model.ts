/** Validated signed form returned by Storage. */
export interface MediaUpload {
  // #region Properties
  /** Owner-allocated upload identifier. */
  readonly uploadId: string;

  /** Browser transfer method. */
  readonly method: 'POST';

  /** Signed browser transfer destination. */
  readonly url: string;

  /** Signed browser transfer fields. */
  readonly fields: Record<string, string>;

  /** Exclusive transfer expiry. */
  readonly expiresAt: string;
  // #endregion
}
