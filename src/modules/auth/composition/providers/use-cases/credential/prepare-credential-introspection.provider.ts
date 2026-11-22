import type { FactoryProvider } from '@nestjs/common';

import { AdmitIntrospection } from '../../../../../rate-limit/public/addresses/admit-introspection.js';
import { PrepareCredentialIntrospection } from '../../../../application/use-cases/commands/credential/prepare-credential-introspection/prepare-credential-introspection.use-case.js';

/** Binds the credential guard's admission use case to the shared limiter. */
export const prepareCredentialIntrospectionProvider: FactoryProvider<PrepareCredentialIntrospection> =
  {
    provide: PrepareCredentialIntrospection,
    inject: [AdmitIntrospection],
    useFactory: (limiter: AdmitIntrospection): PrepareCredentialIntrospection =>
      new PrepareCredentialIntrospection(limiter),
  };
