import type { NotificationCategory } from './notification-category.model.js';
import type { NotificationChannelSettings } from './notification-channel-settings.model.js';

/** Account settings returned by Notification. */
export interface NotificationPreferences {
  // #region Properties
  /** Channel settings for every category. */
  readonly channels: Readonly<Record<NotificationCategory, NotificationChannelSettings>>;

  /** Email delivery cadence. */
  readonly digest: 'each' | 'daily' | 'weekly' | 'never';

  /** Whether mobile quiet hours apply. */
  readonly doNotDisturb: boolean;

  /** Current version of the account settings. */
  readonly version: number;
  // #endregion
}
