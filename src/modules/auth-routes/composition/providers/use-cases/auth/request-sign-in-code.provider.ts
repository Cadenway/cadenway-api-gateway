import type { FactoryProvider } from '@nestjs/common';

import { RequestSignInCode } from '../../../../application/use-cases/commands/auth/request-sign-in-code/request-sign-in-code.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant requestSignInCodeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<RequestSignInCode>}
 */
export const requestSignInCodeProvider: FactoryProvider<RequestSignInCode> = {
  provide: RequestSignInCode,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): RequestSignInCode => new RequestSignInCode(identity),
};
