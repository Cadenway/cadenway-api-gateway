import type { NotificationPreferences } from '../../../../models/preferences/notification-preferences.model.js';
import type { NotificationPreferencesPatch } from '../../../../models/preferences/notification-preferences-patch.model.js';
import type { NotificationPreferencesPort } from '../../../../ports/outbound/notification/preferences/notification-preferences.port.js';

/** Updates the account preferences in Notification. */
export class UpdateNotificationPreferences {
  // #region Constructor
  /** Binds the Notification capability. */
  public constructor(private readonly preferences: NotificationPreferencesPort) {}
  // #endregion

  // #region Methods
  /** Applies the patch with the client's optional version condition. */
  public execute(
    patch: NotificationPreferencesPatch,
    ifMatch?: string,
  ): Promise<NotificationPreferences> {
    return this.preferences.update(patch, ifMatch);
  }
  // #endregion
}
