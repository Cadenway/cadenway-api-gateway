import type { NotificationServiceClient } from '../../../../../../clients/notification-service.client.js';
import type { InboxNotificationCommand } from '../../../../application/ports/outbound/notification-service/inbox/inbox-notification-command.port.js';

/** Adapts checked owner transitions to the generated Notification client. */
export function inboxNotificationCommand(
  client: NotificationServiceClient,
): InboxNotificationCommand {
  return {
    candidate: (id) => client.getInboxNotificationCandidate(id),
    change: (id, subject, action, ifMatch) =>
      action === 'read'
        ? client.markInboxNotificationRead(id, { subject }, ifMatch)
        : client.archiveInboxNotification(id, { subject }, ifMatch),
  };
}
