import type { FactoryProvider } from '@nestjs/common';

import { AnswerSignInChallengeWithBackupCode } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-backup-code/answer-sign-in-challenge-with-backup-code.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../../composition/tokens/auth/identity-auth.token.js';

/**
 * Constant answerSignInChallengeWithBackupCodeProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<AnswerSignInChallengeWithBackupCode>}
 */
export const answerSignInChallengeWithBackupCodeProvider: FactoryProvider<AnswerSignInChallengeWithBackupCode> =
  {
    provide: AnswerSignInChallengeWithBackupCode,
    inject: [IDENTITY_AUTH],
    useFactory: (identity: IdentityAuth): AnswerSignInChallengeWithBackupCode =>
      new AnswerSignInChallengeWithBackupCode(identity),
  };
