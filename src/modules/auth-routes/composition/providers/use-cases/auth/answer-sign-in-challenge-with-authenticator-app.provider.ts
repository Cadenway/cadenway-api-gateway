import type { FactoryProvider } from '@nestjs/common';

import { AnswerSignInChallengeWithAuthenticatorApp } from '../../../../application/use-cases/commands/auth/answer-sign-in-challenge-with-authenticator-app/answer-sign-in-challenge-with-authenticator-app.use-case.js';
import type { IdentityAuth } from '../../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import { IDENTITY_AUTH } from '../../../../composition/tokens/auth/identity-auth.token.js';

/**
 * Constant answerSignInChallengeWithAuthenticatorAppProvider
 *
 * @description
 * Binds the plain use case to the Identity port in its owning module.
 *
 * @type {FactoryProvider<AnswerSignInChallengeWithAuthenticatorApp>}
 */
export const answerSignInChallengeWithAuthenticatorAppProvider: FactoryProvider<AnswerSignInChallengeWithAuthenticatorApp> =
  {
    provide: AnswerSignInChallengeWithAuthenticatorApp,
    inject: [IDENTITY_AUTH],
    useFactory: (identity: IdentityAuth): AnswerSignInChallengeWithAuthenticatorApp =>
      new AnswerSignInChallengeWithAuthenticatorApp(identity),
  };
