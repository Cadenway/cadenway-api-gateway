import { ProblemException } from '@cadenway/nest-common';
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { NotificationServiceClient } from '../../clients/notification-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { InboxGenerationChanged } from './application/models/inbox/inbox-generation-changed.model.js';
import type { InboxNotificationCommand } from './application/ports/outbound/notification-service/inbox/inbox-notification-command.port.js';
import type { InboxNotificationSource } from './application/ports/outbound/notification-service/inbox/inbox-notification-source.port.js';
import type { InboxActorNames } from './application/ports/outbound/organization-service/inbox/inbox-actor-names.port.js';
import type { InboxSubjectVisibility } from './application/ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';
import { ChangeInboxNotification } from './application/use-cases/commands/inbox/change-inbox-notification/change-inbox-notification.use-case.js';
import { MarkInboxNotificationsRead } from './application/use-cases/commands/inbox/mark-inbox-notifications-read/mark-inbox-notifications-read.use-case.js';
import { GetInboxUnreadCount } from './application/use-cases/queries/inbox/get-inbox-unread-count/get-inbox-unread-count.use-case.js';
import { ListInboxNotifications } from './application/use-cases/queries/inbox/list-inbox-notifications/list-inbox-notifications.use-case.js';
import { ScanInboxUnread } from './application/use-cases/queries/inbox/scan-inbox-unread/scan-inbox-unread.use-case.js';
import { inboxNotificationCommand } from './infrastructure/adapters/notification-service/inbox/inbox-notification-command.adapter.js';
import { inboxNotificationSource } from './infrastructure/adapters/notification-service/inbox/inbox-notification-source.adapter.js';
import { inboxActorNames } from './infrastructure/adapters/organization-service/inbox/inbox-actor-names.adapter.js';
import { inboxSubjectVisibility } from './infrastructure/adapters/task-service/inbox/inbox-subject-visibility.adapter.js';
import { InboxController } from './presentation/http/controllers/inbox/inbox.controller.js';

const SOURCE = Symbol('INBOX_SOURCE');
const COMMAND = Symbol('INBOX_COMMAND');
const VISIBILITY = Symbol('INBOX_VISIBILITY');
const NAMES = Symbol('INBOX_NAMES');

/** Converts an internal generation conflict into an application retry signal. */
async function generationChecked<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (
      error instanceof ProblemException &&
      error.problem.status === 409 &&
      error.problem.code === 'notification.inbox-generation-changed'
    ) {
      throw new InboxGenerationChanged();
    }
    throw error;
  }
}

/** Composes owner-scoped inbox operations across Notification, Task and Organization. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [InboxController],
  providers: [
    {
      provide: SOURCE,
      inject: [NotificationServiceClient],
      useFactory: (client: NotificationServiceClient): InboxNotificationSource => {
        const source = inboxNotificationSource(client);
        return {
          ...source,
          listUnreadSubjects: (...args) =>
            generationChecked(() => source.listUnreadSubjects(...args)),
          markReadAll: (...args) => generationChecked(() => source.markReadAll(...args)),
        };
      },
    },
    { provide: COMMAND, inject: [NotificationServiceClient], useFactory: inboxNotificationCommand },
    { provide: VISIBILITY, inject: [TaskServiceClient], useFactory: inboxSubjectVisibility },
    { provide: NAMES, inject: [OrganizationServiceClient], useFactory: inboxActorNames },
    {
      provide: ScanInboxUnread,
      inject: [SOURCE, VISIBILITY],
      useFactory: (source: InboxNotificationSource, visibility: InboxSubjectVisibility) =>
        new ScanInboxUnread(source, visibility),
    },
    {
      provide: ListInboxNotifications,
      inject: [SOURCE, VISIBILITY, NAMES, ScanInboxUnread],
      useFactory: (
        source: InboxNotificationSource,
        visibility: InboxSubjectVisibility,
        names: InboxActorNames,
        unread: ScanInboxUnread,
      ) => new ListInboxNotifications(source, visibility, names, unread),
    },
    {
      provide: GetInboxUnreadCount,
      inject: [ScanInboxUnread],
      useFactory: (unread: ScanInboxUnread) => new GetInboxUnreadCount(unread),
    },
    {
      provide: MarkInboxNotificationsRead,
      inject: [SOURCE, ScanInboxUnread],
      useFactory: (source: InboxNotificationSource, unread: ScanInboxUnread) =>
        new MarkInboxNotificationsRead(source, unread),
    },
    {
      provide: ChangeInboxNotification,
      inject: [COMMAND, VISIBILITY, NAMES],
      useFactory: (
        command: InboxNotificationCommand,
        visibility: InboxSubjectVisibility,
        names: InboxActorNames,
      ) => new ChangeInboxNotification(command, visibility, names),
    },
  ],
})
export class InboxModule implements NestModule {
  // #region Methods
  /** Keeps personal responses and guard errors out of shared caches. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(InboxController);
  }
  // #endregion
}
