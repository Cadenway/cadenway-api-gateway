import type { FactoryProvider } from '@nestjs/common';

import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import type { SessionIntrospector } from '../../../../application/ports/outbound/identity/session/session-introspector.port.js';
import { SESSION_INTROSPECTOR } from '../../../tokens/session/session-introspector.token.js';
import { createSessionIntrospectorAdapter } from '../../../../infrastructure/adapters/identity/session-introspector.adapter.js';

/**
 * Constant sessionIntrospectorProvider
 *
 * @description
 * Owns the outbound port binding for this capability.
 *
 * @type {FactoryProvider<SessionIntrospector>}
 */
export const sessionIntrospectorProvider: FactoryProvider<SessionIntrospector> = {
  provide: SESSION_INTROSPECTOR,
  inject: [IdentityServiceClient],
  useFactory: createSessionIntrospectorAdapter,
};
