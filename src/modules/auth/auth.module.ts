import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import { apiTokenIntrospectorProvider } from './composition/providers/adapters/api-token/api-token-introspector.provider.js';
import { bearerFailureLimitProvider } from './composition/providers/adapters/api-token/bearer-failure-limit.provider.js';
import { sessionIntrospectorProvider } from './composition/providers/adapters/session/session-introspector.provider.js';
import { verifyApiTokenProvider } from './composition/providers/use-cases/api-token/verify-api-token.provider.js';
import { reminderCursorProvider } from './composition/providers/use-cases/reminder/reminder-cursor.provider.js';
import { sprintReportCursorProvider } from './composition/providers/use-cases/reporting/sprint-report-cursor.provider.js';
import { verifySessionProvider } from './composition/providers/use-cases/session/verify-session.provider.js';
import { VerifyApiToken } from './public/api-token/verify-api-token.js';
import { CredentialGuard } from './public/credential/credential-guard.js';
import { ReminderCursor } from './public/reminder/reminder-cursor.js';
import { SprintReportCursor } from './public/reporting/sprint-report-cursor.js';
import { CsrfGuard } from './public/session/csrf-guard.js';
import { VerifySession } from './public/session/verify-session.js';

/**
 * Class AuthModule
 *
 * @description
 * Registers the HTTP guards and the verification of sessions and personal API tokens. The
 * verification use cases are exported with the guards: a route module that applies
 * `CredentialGuard` instantiates it in its own injector. `RateLimitModule` gives the verification
 * of a bearer token the limit of the failed authentications of a client address.
 */
@Module({
  imports: [ClientsModule, RateLimitModule],
  providers: [
    sessionIntrospectorProvider,
    apiTokenIntrospectorProvider,
    bearerFailureLimitProvider,
    sprintReportCursorProvider,
    reminderCursorProvider,
    verifySessionProvider,
    verifyApiTokenProvider,
    CsrfGuard,
    CredentialGuard,
  ],
  exports: [
    CsrfGuard,
    CredentialGuard,
    VerifySession,
    VerifyApiToken,
    SprintReportCursor,
    ReminderCursor,
  ],
})
export class AuthModule {}
