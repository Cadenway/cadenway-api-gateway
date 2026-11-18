import type { FactoryProvider } from '@nestjs/common';

import { InspectPasswordResetLink } from '../../../../application/use-cases/queries/auth/inspect-password-reset-link/inspect-password-reset-link.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../tokens/auth/identity-auth.token.js';

/**
 * Constant inspectPasswordResetLinkProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<InspectPasswordResetLink>}
 */
export const inspectPasswordResetLinkProvider: FactoryProvider<InspectPasswordResetLink> = {
  provide: InspectPasswordResetLink,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): InspectPasswordResetLink =>
    new InspectPasswordResetLink(identity),
};
