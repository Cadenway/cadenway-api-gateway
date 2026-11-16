import type { FactoryProvider } from '@nestjs/common';

import { GetCurrentUser } from '../../../../application/use-cases/queries/me/get-current-user/get-current-user.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant getCurrentUserProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<GetCurrentUser>}
 */
export const getCurrentUserProvider: FactoryProvider<GetCurrentUser> = {
  provide: GetCurrentUser,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): GetCurrentUser => new GetCurrentUser(identity),
};
