import type { FactoryProvider } from '@nestjs/common';

import { SignOut } from '../../../../application/use-cases/commands/auth/sign-out/sign-out.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant signOutProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<SignOut>}
 */
export const signOutProvider: FactoryProvider<SignOut> = {
  provide: SignOut,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): SignOut => new SignOut(identity),
};
