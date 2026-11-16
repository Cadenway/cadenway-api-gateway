import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { sessionIntrospectorProvider } from './composition/providers/adapters/session/session-introspector.provider.js';
import { verifySessionProvider } from './composition/providers/use-cases/session/verify-session.provider.js';
import { CsrfGuard } from './public/session/csrf-guard.js';
import { SessionGuard } from './public/session/session-guard.js';
import { VerifySession } from './public/session/verify-session.js';

/**
 * Class AuthModule
 *
 * @description
 * Registers the HTTP guards and session verification dependencies.
 */
@Module({
  imports: [ClientsModule],
  providers: [sessionIntrospectorProvider, verifySessionProvider, CsrfGuard, SessionGuard],
  exports: [CsrfGuard, SessionGuard, VerifySession],
})
export class AuthModule {}
