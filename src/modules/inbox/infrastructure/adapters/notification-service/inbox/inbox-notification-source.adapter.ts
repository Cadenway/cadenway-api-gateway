import type { NotificationServiceClient } from '../../../../../../clients/notification-service.client.js';
import type { InboxNotificationSource } from '../../../../application/ports/outbound/notification-service/inbox/inbox-notification-source.port.js';

/** Binds recipient-scoped inbox operations to the generated Notification client. */
export function inboxNotificationSource(
  client: NotificationServiceClient,
): InboxNotificationSource {
  return {
    listCandidates: (query, signal) => {
      signal.throwIfAborted();
      return client.listInboxNotifications(
        {
          state: query.state,
          limit: query.limit,
          ...(query.cursor === null ? {} : { cursor: query.cursor }),
        },
        signal,
      );
    },
    listUnreadSubjects: (cursor, limit, signal) => {
      signal.throwIfAborted();
      return client.listInboxUnreadSubjects(
        { limit, ...(cursor === null ? {} : { cursor }) },
        signal,
      );
    },
    markReadAll: (selection, signal) => {
      signal.throwIfAborted();
      return client.markInboxNotificationsRead(
        { ...selection, authorizedSubjects: [...selection.authorizedSubjects] },
        signal,
      );
    },
  };
}
