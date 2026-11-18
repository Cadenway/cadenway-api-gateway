import {
  Module,
  type FactoryProvider,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { TwoStepVerificationRegistry } from './application/ports/outbound/identity/two-step/two-step-verification-registry.port.js';
import { AddSecurityKey } from './application/use-cases/commands/two-step/add-security-key/add-security-key.use-case.js';
import { ConfirmAuthenticatorAppSetup } from './application/use-cases/commands/two-step/confirm-authenticator-app-setup/confirm-authenticator-app-setup.use-case.js';
import { DisableTwoStepVerification } from './application/use-cases/commands/two-step/disable-two-step-verification/disable-two-step-verification.use-case.js';
import { RegenerateBackupCodes } from './application/use-cases/commands/two-step/regenerate-backup-codes/regenerate-backup-codes.use-case.js';
import { RemoveSecurityKey } from './application/use-cases/commands/two-step/remove-security-key/remove-security-key.use-case.js';
import { StartAuthenticatorAppSetup } from './application/use-cases/commands/two-step/start-authenticator-app-setup/start-authenticator-app-setup.use-case.js';
import { StartSecurityKeyRegistration } from './application/use-cases/commands/two-step/start-security-key-registration/start-security-key-registration.use-case.js';
import { GetTwoStepVerification } from './application/use-cases/queries/two-step/get-two-step-verification/get-two-step-verification.use-case.js';
import { createTwoStepVerificationRegistryAdapter } from './infrastructure/adapters/identity/two-step-verification-registry.adapter.js';
import { TwoStepVerificationController } from './presentation/http/controllers/two-step-verification/two-step-verification.controller.js';

/**
 * Constant TWO_STEP_VERIFICATION_REGISTRY
 *
 * @description
 * Injection token of the `TwoStepVerificationRegistry` port.
 *
 * @type {unique symbol}
 */
const TWO_STEP_VERIFICATION_REGISTRY: unique symbol = Symbol('TwoStepVerificationRegistry');

/**
 * Constant PROVIDERS
 *
 * @description
 * The port of the capability bound to its adapter, and the use cases bound to the port.
 *
 * @type {readonly FactoryProvider[]}
 */
const PROVIDERS: readonly FactoryProvider[] = [
  {
    provide: TWO_STEP_VERIFICATION_REGISTRY,
    inject: [IdentityServiceClient],
    useFactory: createTwoStepVerificationRegistryAdapter,
  },
  {
    provide: GetTwoStepVerification,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): GetTwoStepVerification =>
      new GetTwoStepVerification(registry),
  },
  {
    provide: DisableTwoStepVerification,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): DisableTwoStepVerification =>
      new DisableTwoStepVerification(registry),
  },
  {
    provide: StartAuthenticatorAppSetup,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): StartAuthenticatorAppSetup =>
      new StartAuthenticatorAppSetup(registry),
  },
  {
    provide: ConfirmAuthenticatorAppSetup,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): ConfirmAuthenticatorAppSetup =>
      new ConfirmAuthenticatorAppSetup(registry),
  },
  {
    provide: RegenerateBackupCodes,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): RegenerateBackupCodes =>
      new RegenerateBackupCodes(registry),
  },
  {
    provide: StartSecurityKeyRegistration,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): StartSecurityKeyRegistration =>
      new StartSecurityKeyRegistration(registry),
  },
  {
    provide: AddSecurityKey,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): AddSecurityKey =>
      new AddSecurityKey(registry),
  },
  {
    provide: RemoveSecurityKey,
    inject: [TWO_STEP_VERIFICATION_REGISTRY],
    useFactory: (registry: TwoStepVerificationRegistry): RemoveSecurityKey =>
      new RemoveSecurityKey(registry),
  },
];

/**
 * Class TwoStepVerificationModule
 *
 * @description
 * The routes of the tag `two-step-verification` of `openapi/public/auth.yaml` under
 * `/v1/me/two-step-verification`. The capability owns its port to identity-service and imports the
 * shared authentication and rate-limit guards. Every answer, errors included, carries
 * `Cache-Control: no-store`, as the contract requires of the routes of this tag: some carry a TOTP
 * secret, backup codes or WebAuthn options.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS],
  controllers: [TwoStepVerificationController],
})
export class TwoStepVerificationModule implements NestModule {
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
    consumer.apply(noStore).forRoutes(TwoStepVerificationController);
  }
  // #endregion
}
