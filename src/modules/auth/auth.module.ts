import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { apiTokenIntrospectorProvider } from './composition/providers/adapters/api-token/api-token-introspector.provider.js';
import { bearerFailureLimitProvider } from './composition/providers/adapters/api-token/bearer-failure-limit.provider.js';
import { sessionIntrospectorProvider } from './composition/providers/adapters/session/session-introspector.provider.js';
import { prepareCredentialIntrospectionProvider } from './composition/providers/use-cases/credential/prepare-credential-introspection.provider.js';
import { verifyApiTokenProvider } from './composition/providers/use-cases/api-token/verify-api-token.provider.js';
import { federatedSignInProviders } from './composition/providers/use-cases/federated-sign-in/federated-sign-in.provider.js';
import { reminderCursorProvider } from './composition/providers/use-cases/reminder/reminder-cursor.provider.js';
import { sprintReportCursorProvider } from './composition/providers/use-cases/reporting/sprint-report-cursor.provider.js';
import { verifySessionProvider } from './composition/providers/use-cases/session/verify-session.provider.js';
import { FederatedSignInController } from './presentation/http/controllers/federated-sign-in/federated-sign-in.controller.js';
import { VerifyApiToken } from './public/api-token/verify-api-token.js';
import { PrepareCredentialIntrospection } from './public/credential/prepare-credential-introspection.js';
import { CredentialGuard } from './public/credential/credential-guard.js';
import { ReminderCursor } from './public/reminder/reminder-cursor.js';
import { SprintReportCursor } from './public/reporting/sprint-report-cursor.js';
import { CsrfGuard } from './public/session/csrf-guard.js';
import { VerifySession } from './public/session/verify-session.js';

/**
 * Class AuthModule
 *
 * @description
 * Registers federated sign-in, HTTP guards and verification of sessions and personal API tokens. The
 * verification use cases are exported with the guards: a route module that applies
 * `CredentialGuard` instantiates it in its own injector. `RateLimitModule` gives the verification
 * of a bearer token the limit of the failed authentications of a client address.
 */
@Module({
  imports: [ClientsModule, RateLimitModule],
  controllers: [FederatedSignInController],
  providers: [
    sessionIntrospectorProvider,
    apiTokenIntrospectorProvider,
    bearerFailureLimitProvider,
    sprintReportCursorProvider,
    reminderCursorProvider,
    verifySessionProvider,
    verifyApiTokenProvider,
    prepareCredentialIntrospectionProvider,
    ...federatedSignInProviders,
    CsrfGuard,
    CredentialGuard,
  ],
  exports: [
    PrepareCredentialIntrospection,
    CsrfGuard,
    CredentialGuard,
    VerifySession,
    VerifyApiToken,
    SprintReportCursor,
    ReminderCursor,
  ],
})
export class AuthModule {}
