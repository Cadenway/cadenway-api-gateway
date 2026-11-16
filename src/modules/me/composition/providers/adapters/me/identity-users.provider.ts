import type { FactoryProvider } from '@nestjs/common';

import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';
import { createIdentityUsersAdapter } from '../../../../infrastructure/adapters/identity/identity-users.adapter.js';

/**
 * Constant identityUsersProvider
 *
 * @description
 * Owns the outbound port binding for this capability.
 *
 * @type {FactoryProvider<IdentityUsers>}
 */
export const identityUsersProvider: FactoryProvider<IdentityUsers> = {
  provide: IDENTITY_USERS,
  inject: [IdentityServiceClient],
  useFactory: createIdentityUsersAdapter,
};
