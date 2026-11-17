import type { FactoryProvider } from '@nestjs/common';

import { ScheduleAccountDeletion } from '../../../../application/use-cases/commands/me/schedule-account-deletion/schedule-account-deletion.use-case.js';
import type { IdentityUsers } from '../../../../application/ports/outbound/identity/me/identity-users.port.js';
import { IDENTITY_USERS } from '../../../tokens/me/identity-users.token.js';

/**
 * Constant scheduleAccountDeletionProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<ScheduleAccountDeletion>}
 */
export const scheduleAccountDeletionProvider: FactoryProvider<ScheduleAccountDeletion> = {
  provide: ScheduleAccountDeletion,
  inject: [IDENTITY_USERS],
  useFactory: (identity: IdentityUsers): ScheduleAccountDeletion =>
    new ScheduleAccountDeletion(identity),
};
