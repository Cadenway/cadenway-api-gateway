import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ClientsModule } from '../../clients/clients.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { identityUsersProvider } from './composition/providers/adapters/me/identity-users.provider.js';

import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { MeController } from './presentation/http/controllers/me/me.controller.js';

import { getCurrentUserProvider } from './composition/providers/use-cases/me/get-current-user.provider.js';
import { updateCurrentUserProvider } from './composition/providers/use-cases/me/update-current-user.provider.js';
import { changePasswordProvider } from './composition/providers/use-cases/me/change-password.provider.js';
import { requestEmailChangeProvider } from './composition/providers/use-cases/me/request-email-change.provider.js';
import { confirmEmailChangeProvider } from './composition/providers/use-cases/me/confirm-email-change.provider.js';
import { scheduleAccountDeletionProvider } from './composition/providers/use-cases/me/schedule-account-deletion.provider.js';

/**
 * Class MeRoutesModule
 *
 * @description
 * The routes of `openapi/public/auth.yaml` under `/v1/me`: the account of the session, its
 * profile, and the security of the account (password, address, deletion). Every answer, errors
 * included, carries `Cache-Control: no-store`.
 * The capability owns its Identity port and imports the shared authentication and rate-limit
 * guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [
    identityUsersProvider,
    getCurrentUserProvider,
    updateCurrentUserProvider,
    changePasswordProvider,
    requestEmailChangeProvider,
    confirmEmailChangeProvider,
    scheduleAccountDeletionProvider,
  ],
  controllers: [MeController],
})
export class MeRoutesModule implements NestModule {
  // #region Methods
  /**
   * Method configure
   *
   * @description
   * Applies `noStore` to the routes of the module, before their guards.
   *
   * @param {MiddlewareConsumer} consumer - Middleware registry of NestJS.
   */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(MeController);
  }
  // #endregion
}
