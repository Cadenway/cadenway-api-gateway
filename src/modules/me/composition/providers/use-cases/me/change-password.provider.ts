import type { FactoryProvider } from '@nestjs/common';

import { ChangePassword } from '../../../../application/use-cases/commands/me/change-password/change-password.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant changePasswordProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<ChangePassword>}
 */
export const changePasswordProvider: FactoryProvider<ChangePassword> = {
  provide: ChangePassword,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): ChangePassword => new ChangePassword(identity),
};
