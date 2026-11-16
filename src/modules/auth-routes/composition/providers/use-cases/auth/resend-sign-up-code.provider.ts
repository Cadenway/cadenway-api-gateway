import type { FactoryProvider } from '@nestjs/common';

import { ResendSignUpCode } from '../../../../application/use-cases/commands/auth/resend-sign-up-code/resend-sign-up-code.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant resendSignUpCodeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<ResendSignUpCode>}
 */
export const resendSignUpCodeProvider: FactoryProvider<ResendSignUpCode> = {
  provide: ResendSignUpCode,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): ResendSignUpCode => new ResendSignUpCode(identity),
};
