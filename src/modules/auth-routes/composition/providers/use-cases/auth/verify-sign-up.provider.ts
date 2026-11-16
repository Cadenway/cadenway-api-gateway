import type { FactoryProvider } from '@nestjs/common';

import { VerifySignUp } from '../../../../application/use-cases/commands/auth/verify-sign-up/verify-sign-up.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant verifySignUpProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<VerifySignUp>}
 */
export const verifySignUpProvider: FactoryProvider<VerifySignUp> = {
  provide: VerifySignUp,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): VerifySignUp => new VerifySignUp(identity),
};
