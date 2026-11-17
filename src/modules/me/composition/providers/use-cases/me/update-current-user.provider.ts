import type { FactoryProvider } from '@nestjs/common';

import { UpdateCurrentUser } from '../../../../application/use-cases/commands/me/update-current-user/update-current-user.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant updateCurrentUserProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<UpdateCurrentUser>}
 */
export const updateCurrentUserProvider: FactoryProvider<UpdateCurrentUser> = {
  provide: UpdateCurrentUser,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): UpdateCurrentUser => new UpdateCurrentUser(identity),
};
