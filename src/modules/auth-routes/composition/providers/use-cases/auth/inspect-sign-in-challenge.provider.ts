import type { FactoryProvider } from '@nestjs/common';

import { InspectSignInChallenge } from '../../../../application/use-cases/queries/auth/inspect-sign-in-challenge/inspect-sign-in-challenge.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../../composition/tokens/auth/identity-auth.token.js';

/**
 * Constant inspectSignInChallengeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<InspectSignInChallenge>}
 */
export const inspectSignInChallengeProvider: FactoryProvider<InspectSignInChallenge> = {
  provide: InspectSignInChallenge,
  inject: [IDENTITY_AUTH],
  useFactory: (identity: IdentityAuth): InspectSignInChallenge =>
    new InspectSignInChallenge(identity),
};
