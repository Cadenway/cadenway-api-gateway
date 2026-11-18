import type { FactoryProvider } from '@nestjs/common';

import { GetSignInChallengeSecurityKeyOptions } from '../../../../application/use-cases/commands/auth/get-sign-in-challenge-security-key-options/get-sign-in-challenge-security-key-options.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../../composition/tokens/auth/identity-auth.token.js';

/**
 * Constant getSignInChallengeSecurityKeyOptionsProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<GetSignInChallengeSecurityKeyOptions>}
 */
export const getSignInChallengeSecurityKeyOptionsProvider: FactoryProvider<GetSignInChallengeSecurityKeyOptions> =
  {
    provide: GetSignInChallengeSecurityKeyOptions,
    inject: [IDENTITY_AUTH],
    useFactory: (identity: IdentityAuth): GetSignInChallengeSecurityKeyOptions =>
      new GetSignInChallengeSecurityKeyOptions(identity),
  };
