import type { FactoryProvider } from '@nestjs/common';

import { DiscoverSignInMethods } from '../../../../application/use-cases/queries/auth/discover-sign-in-methods/discover-sign-in-methods.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant discoverSignInMethodsProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<DiscoverSignInMethods>}
 */
export const discoverSignInMethodsProvider: FactoryProvider<DiscoverSignInMethods> = {
  provide: DiscoverSignInMethods,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): DiscoverSignInMethods =>
    new DiscoverSignInMethods(identity),
};
