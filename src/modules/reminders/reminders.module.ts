import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { z } from 'zod';

import { ClientsModule } from '../../clients/clients.module.js';
import { NotificationServiceClient } from '../../clients/notification-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReminderCursor } from '../auth/public/reminder/reminder-cursor.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { ReminderPageCursor } from './application/ports/outbound/crypto/reminder/reminder-page-cursor.port.js';
import { AccessReminder } from './application/use-cases/queries/reminder/access-reminder/access-reminder.use-case.js';
import { ListReminders } from './application/use-cases/queries/reminder/list-reminders/list-reminders.use-case.js';
import {
  reminderListSource,
  reminderOperations,
} from './infrastructure/adapters/notification-service/reminder/reminder-source.adapter.js';
import {
  reminderTaskByKey,
  reminderTaskDirectory,
} from './infrastructure/adapters/task-service/reminder/reminder-task.adapter.js';
import { RemindersController } from './presentation/http/controllers/reminder/reminders.controller.js';

const positionSchema = z.strictObject({ id: z.uuid(), remindAt: z.iso.datetime() });

/** Public reminder routes and their private Task and Notification adapters. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [RemindersController],
  providers: [
    {
      provide: AccessReminder,
      inject: [NotificationServiceClient, TaskServiceClient],
      useFactory: (
        notification: NotificationServiceClient,
        task: TaskServiceClient,
      ): AccessReminder =>
        new AccessReminder(reminderOperations(notification), reminderTaskDirectory(task), (key) =>
          reminderTaskByKey(task, key),
        ),
    },
    {
      provide: ListReminders,
      inject: [NotificationServiceClient, TaskServiceClient, ReminderCursor],
      useFactory: (
        notification: NotificationServiceClient,
        task: TaskServiceClient,
        cursor: ReminderCursor,
      ): ListReminders => {
        const codec: ReminderPageCursor = {
          seal: (position, scope) => cursor.execute('seal', JSON.stringify(position), scope),
          open: (value, scope) => {
            const raw = cursor.execute('open', value, scope);
            if (raw === null) return null;
            try {
              const result = positionSchema.safeParse(JSON.parse(raw) as unknown);
              return result.success ? result.data : null;
            } catch {
              return null;
            }
          },
        };
        return new ListReminders(
          reminderListSource(notification),
          reminderTaskDirectory(task),
          codec,
        );
      },
    },
  ],
})
export class RemindersModule implements NestModule {
  // #region Methods
  /** Keeps personal responses and guard errors out of shared caches. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(RemindersController);
  }
  // #endregion
}
