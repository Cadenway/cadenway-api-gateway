import type { NotificationCategory } from './notification-category.model.js';
import type { NotificationChannelSettings } from './notification-channel-settings.model.js';
import type { NotificationPreferences } from './notification-preferences.model.js';

/** A partial update; absent settings retain their current value. */
export interface NotificationPreferencesPatch {
  // #region Properties
  /** Partial channel settings grouped by category. */
  readonly channels?: Partial<Record<NotificationCategory, Partial<NotificationChannelSettings>>>;

  /** Replacement email cadence. */
  readonly digest?: NotificationPreferences['digest'];

  /** Replacement quiet-hours setting. */
  readonly doNotDisturb?: boolean;
  // #endregion
}
