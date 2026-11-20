import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { NotificationServiceClient } from '../../clients/notification-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { NotificationPreferencesPort } from './application/ports/outbound/notification/preferences/notification-preferences.port.js';
import { UpdateNotificationPreferences } from './application/use-cases/commands/preferences/update-notification-preferences/update-notification-preferences.use-case.js';
import { GetNotificationPreferences } from './application/use-cases/queries/preferences/get-notification-preferences/get-notification-preferences.use-case.js';
import { notificationPreferencesAdapter } from './infrastructure/adapters/notification/preferences/notification-preferences.adapter.js';
import { NotificationPreferencesController } from './presentation/http/controllers/preferences/notification-preferences.controller.js';

const PREFERENCES = Symbol('NOTIFICATION_PREFERENCES');

/** Routes account notification preferences through the Notification service. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [NotificationPreferencesController],
  providers: [
    {
      provide: PREFERENCES,
      inject: [NotificationServiceClient],
      useFactory: notificationPreferencesAdapter,
    },
    {
      provide: GetNotificationPreferences,
      inject: [PREFERENCES],
      useFactory: (port: NotificationPreferencesPort): GetNotificationPreferences =>
        new GetNotificationPreferences(port),
    },
    {
      provide: UpdateNotificationPreferences,
      inject: [PREFERENCES],
      useFactory: (port: NotificationPreferencesPort): UpdateNotificationPreferences =>
        new UpdateNotificationPreferences(port),
    },
  ],
})
export class NotificationPreferencesModule implements NestModule {
  // #region Methods
  /** Keeps personal responses and guard errors out of shared caches. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(NotificationPreferencesController);
  }
  // #endregion
}
