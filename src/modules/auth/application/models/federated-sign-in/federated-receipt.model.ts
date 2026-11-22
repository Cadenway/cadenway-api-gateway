/** Opaque one-use receipt and the instant when it stops working. */
export interface FederatedReceipt {
  // #region Properties
  /** Secret returned only to the browser's receipt cookie. */
  readonly receipt: string;

  /** Expiration as an ISO 8601 instant. */
  readonly expiresAt: string;
  // #endregion
}
