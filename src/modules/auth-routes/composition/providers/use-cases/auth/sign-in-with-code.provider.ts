import type { FactoryProvider } from '@nestjs/common';

import { SignInWithCode } from '../../../../application/use-cases/commands/auth/sign-in-with-code/sign-in-with-code.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant signInWithCodeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<SignInWithCode>}
 */
export const signInWithCodeProvider: FactoryProvider<SignInWithCode> = {
  provide: SignInWithCode,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): SignInWithCode => new SignInWithCode(identity),
};
