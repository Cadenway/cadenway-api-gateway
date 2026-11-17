import type { FactoryProvider } from '@nestjs/common';

import { RequestPasswordReset } from '../../../../application/use-cases/commands/auth/request-password-reset/request-password-reset.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant requestPasswordResetProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<RequestPasswordReset>}
 */
export const requestPasswordResetProvider: FactoryProvider<RequestPasswordReset> = {
  provide: RequestPasswordReset,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): RequestPasswordReset => new RequestPasswordReset(identity),
};
