import type { FactoryProvider } from '@nestjs/common';

import { Reauthenticate } from '../../../../application/use-cases/commands/auth/reauthenticate/reauthenticate.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant reauthenticateProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<Reauthenticate>}
 */
export const reauthenticateProvider: FactoryProvider<Reauthenticate> = {
  provide: Reauthenticate,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): Reauthenticate => new Reauthenticate(identity),
};
