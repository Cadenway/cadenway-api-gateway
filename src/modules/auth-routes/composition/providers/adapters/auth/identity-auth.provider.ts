import type { FactoryProvider } from '@nestjs/common';

import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';
import { createIdentityAuthAdapter } from '../../../../infrastructure/adapters/identity/identity-auth.adapter.js';

/**
 * Constant identityAuthProvider
 *
 * @description
 * Owns the outbound port binding for this capability.
 *
 * @type {FactoryProvider<IdentityAuth>}
 */
export const identityAuthProvider: FactoryProvider<IdentityAuth> = {
  provide: IDENTITY_AUTH,
  inject: [IdentityServiceClient],
  useFactory: createIdentityAuthAdapter,
};
