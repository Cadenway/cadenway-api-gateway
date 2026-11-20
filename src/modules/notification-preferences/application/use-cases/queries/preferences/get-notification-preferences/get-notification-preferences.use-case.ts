import type { NotificationPreferences } from '../../../../models/preferences/notification-preferences.model.js';
import type { NotificationPreferencesPort } from '../../../../ports/outbound/notification/preferences/notification-preferences.port.js';

/** Reads the account preferences using the verified request context. */
export class GetNotificationPreferences {
  // #region Constructor
  /** Binds the Notification capability. */
  public constructor(private readonly preferences: NotificationPreferencesPort) {}
  // #endregion

  // #region Methods
  /** Reads the current preferences. */
  public execute(): Promise<NotificationPreferences> {
    return this.preferences.get();
  }
  // #endregion
}
