import type { FactoryProvider } from '@nestjs/common';

import { SignInWithPassword } from '../../../../application/use-cases/commands/auth/sign-in-with-password/sign-in-with-password.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant signInWithPasswordProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<SignInWithPassword>}
 */
export const signInWithPasswordProvider: FactoryProvider<SignInWithPassword> = {
  provide: SignInWithPassword,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): SignInWithPassword => new SignInWithPassword(identity),
};
