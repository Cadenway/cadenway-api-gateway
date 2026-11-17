import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ClientsModule } from '../../clients/clients.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { identityAuthProvider } from './composition/providers/adapters/auth/identity-auth.provider.js';

import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { AuthController } from './presentation/http/controllers/auth/auth.controller.js';
import { ReauthenticationController } from './presentation/http/controllers/reauthentication/reauthentication.controller.js';

import { discoverSignInMethodsProvider } from './composition/providers/use-cases/auth/discover-sign-in-methods.provider.js';
import { signUpProvider } from './composition/providers/use-cases/auth/sign-up.provider.js';
import { resendSignUpCodeProvider } from './composition/providers/use-cases/auth/resend-sign-up-code.provider.js';
import { verifySignUpProvider } from './composition/providers/use-cases/auth/verify-sign-up.provider.js';
import { signInWithPasswordProvider } from './composition/providers/use-cases/auth/sign-in-with-password.provider.js';
import { requestSignInCodeProvider } from './composition/providers/use-cases/auth/request-sign-in-code.provider.js';
import { signInWithCodeProvider } from './composition/providers/use-cases/auth/sign-in-with-code.provider.js';
import { signOutProvider } from './composition/providers/use-cases/auth/sign-out.provider.js';
import { requestPasswordResetProvider } from './composition/providers/use-cases/auth/request-password-reset.provider.js';
import { inspectPasswordResetLinkProvider } from './composition/providers/use-cases/auth/inspect-password-reset-link.provider.js';
import { confirmPasswordResetProvider } from './composition/providers/use-cases/auth/confirm-password-reset.provider.js';
import { reauthenticateProvider } from './composition/providers/use-cases/auth/reauthenticate.provider.js';

/**
 * Class AuthRoutesModule
 *
 * @description
 * The routes of `openapi/public/auth.yaml` under `/v1/auth`: sign-up, sign-in, sign-out, password
 * reset and re-authentication. Every answer, errors included, carries `Cache-Control: no-store`.
 * The capability owns its Identity port and imports the shared authentication and rate-limit
 * guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [
    identityAuthProvider,
    discoverSignInMethodsProvider,
    signUpProvider,
    resendSignUpCodeProvider,
    verifySignUpProvider,
    signInWithPasswordProvider,
    requestSignInCodeProvider,
    signInWithCodeProvider,
    signOutProvider,
    requestPasswordResetProvider,
    inspectPasswordResetLinkProvider,
    confirmPasswordResetProvider,
    reauthenticateProvider,
  ],
  controllers: [AuthController, ReauthenticationController],
})
export class AuthRoutesModule implements NestModule {
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
    consumer.apply(noStore).forRoutes(AuthController, ReauthenticationController);
  }
  // #endregion
}
