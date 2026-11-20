import type { NotificationServiceClient } from '../../../../../../clients/notification-service.client.js';
import type { NotificationPreferencesPort } from '../../../../application/ports/outbound/notification/preferences/notification-preferences.port.js';

/** Binds the capability port to the validated internal Notification client. */
export function notificationPreferencesAdapter(
  client: NotificationServiceClient,
): NotificationPreferencesPort {
  return {
    get: () => client.getNotificationPreferences(),
    update: (patch, ifMatch) => client.updateNotificationPreferences(patch, ifMatch),
  };
}
