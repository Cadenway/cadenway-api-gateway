import type { FactoryProvider } from '@nestjs/common';

import { VerifySession } from '../../../../application/use-cases/queries/session/verify-session/verify-session.use-case.js';
import type { SessionIntrospector } from '../../../../application/ports/outbound/identity/session/session-introspector.port.js';
import { SESSION_INTROSPECTOR } from '../../../tokens/session/session-introspector.token.js';

/**
 * Constant verifySessionProvider
 *
 * @description
 * Assembles the plain session verification use case.
 *
 * @type {FactoryProvider<VerifySession>}
 */
export const verifySessionProvider: FactoryProvider<VerifySession> = {
  provide: VerifySession,
  inject: [SESSION_INTROSPECTOR],
  useFactory: (introspector: SessionIntrospector): VerifySession => new VerifySession(introspector),
};
