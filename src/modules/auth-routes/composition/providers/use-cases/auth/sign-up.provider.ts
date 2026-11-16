import type { FactoryProvider } from '@nestjs/common';

import { SignUp } from '../../../../application/use-cases/commands/auth/sign-up/sign-up.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant signUpProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<SignUp>}
 */
export const signUpProvider: FactoryProvider<SignUp> = {
  provide: SignUp,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): SignUp => new SignUp(identity),
};
