import type { FactoryProvider } from '@nestjs/common';

import { AnswerSignInChallengeWithSecurityKey } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-security-key/answer-sign-in-challenge-with-security-key.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../../composition/tokens/auth/identity-auth.token.js';

/**
 * Constant answerSignInChallengeWithSecurityKeyProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<AnswerSignInChallengeWithSecurityKey>}
 */
export const answerSignInChallengeWithSecurityKeyProvider: FactoryProvider<AnswerSignInChallengeWithSecurityKey> =
  {
    provide: AnswerSignInChallengeWithSecurityKey,
    inject: [IDENTITY_AUTH],
    useFactory: (identity: IdentityAuth): AnswerSignInChallengeWithSecurityKey =>
      new AnswerSignInChallengeWithSecurityKey(identity),
  };
