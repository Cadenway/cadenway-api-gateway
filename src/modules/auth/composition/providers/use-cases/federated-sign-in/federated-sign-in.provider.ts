import type { FactoryProvider } from '@nestjs/common';

import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import { StartFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/start-federated-sign-in/start-federated-sign-in.use-case.js';
import { CompleteOauthSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-oauth-sign-in/complete-oauth-sign-in.use-case.js';
import { CompleteSamlSignIn } from '../../../../application/use-cases/commands/federated-sign-in/complete-saml-sign-in/complete-saml-sign-in.use-case.js';
import { FinishFederatedSignIn } from '../../../../application/use-cases/commands/federated-sign-in/finish-federated-sign-in/finish-federated-sign-in.use-case.js';

/** Binds the four sign-in use cases to the validating Identity client. */
export const federatedSignInProviders: readonly FactoryProvider[] = [
  {
    provide: StartFederatedSignIn,
    inject: [IdentityServiceClient],
    useFactory: (identity: IdentityServiceClient) => new StartFederatedSignIn(identity),
  },
  {
    provide: CompleteOauthSignIn,
    inject: [IdentityServiceClient],
    useFactory: (identity: IdentityServiceClient) => new CompleteOauthSignIn(identity),
  },
  {
    provide: CompleteSamlSignIn,
    inject: [IdentityServiceClient],
    useFactory: (identity: IdentityServiceClient) => new CompleteSamlSignIn(identity),
  },
  {
    provide: FinishFederatedSignIn,
    inject: [IdentityServiceClient],
    useFactory: (identity: IdentityServiceClient) => new FinishFederatedSignIn(identity),
  },
];
