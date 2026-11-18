import type { FactoryProvider } from '@nestjs/common';

import { ConfirmPasswordReset } from '../../../../application/use-cases/commands/auth/confirm-password-reset/confirm-password-reset.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant confirmPasswordResetProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<ConfirmPasswordReset>}
 */
export const confirmPasswordResetProvider: FactoryProvider<ConfirmPasswordReset> = {
  provide: ConfirmPasswordReset,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): ConfirmPasswordReset => new ConfirmPasswordReset(identity),
};
