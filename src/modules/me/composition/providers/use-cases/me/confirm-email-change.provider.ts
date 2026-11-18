import type { FactoryProvider } from '@nestjs/common';

import { ConfirmEmailChange } from '../../../../application/use-cases/commands/me/confirm-email-change/confirm-email-change.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant confirmEmailChangeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<ConfirmEmailChange>}
 */
export const confirmEmailChangeProvider: FactoryProvider<ConfirmEmailChange> = {
  provide: ConfirmEmailChange,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): ConfirmEmailChange => new ConfirmEmailChange(identity),
};
