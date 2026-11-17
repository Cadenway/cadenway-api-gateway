import type { FactoryProvider } from '@nestjs/common';

import { RequestEmailChange } from '../../../../application/use-cases/commands/me/request-email-change/request-email-change.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant requestEmailChangeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<RequestEmailChange>}
 */
export const requestEmailChangeProvider: FactoryProvider<RequestEmailChange> = {
  provide: RequestEmailChange,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): RequestEmailChange => new RequestEmailChange(identity),
};
