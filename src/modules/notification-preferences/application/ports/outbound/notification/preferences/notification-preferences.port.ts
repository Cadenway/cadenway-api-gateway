import type { NotificationPreferences } from '../../../../models/preferences/notification-preferences.model.js';
import type { NotificationPreferencesPatch } from '../../../../models/preferences/notification-preferences-patch.model.js';

/** Account preferences exposed by the Notification service. */
export interface NotificationPreferencesPort {
  // #region Methods
  /** Reads the verified account's preferences. */
  get(): Promise<NotificationPreferences>;

  /** Applies a patch and relays the optional precondition. */
  update(patch: NotificationPreferencesPatch, ifMatch?: string): Promise<NotificationPreferences>;
  // #endregion
}
