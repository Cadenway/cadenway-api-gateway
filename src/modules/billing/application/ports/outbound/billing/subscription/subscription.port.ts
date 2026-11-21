/** Reads the subscription after confirming the current organization owner's authority. */
export interface SubscriptionPort {
  // #region Properties
  /** Reads and returns the owning service's validated subscription. */
  readonly read: () => Promise<object>;
  // #endregion
}
