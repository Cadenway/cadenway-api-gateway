/** One notification category's channel settings. */
export interface NotificationChannelSettings {
  // #region Properties
  /** Whether an in-app notification is enabled. */
  readonly inApp: boolean;

  /** Whether an email is enabled. */
  readonly email: boolean;

  /** Whether a mobile notification is enabled. */
  readonly mobile: boolean;
  // #endregion
}
