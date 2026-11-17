import type { FactoryProvider } from '@nestjs/common';

import { VerifyApiToken } from '../../../../application/use-cases/queries/api-token/verify-api-token/verify-api-token.use-case.js';
import type { ApiTokenIntrospector } from '../../../../application/ports/outbound/identity/api-token/api-token-introspector.port.js';
import { API_TOKEN_INTROSPECTOR } from '../../../tokens/api-token/api-token-introspector.token.js';

/**
 * Constant verifyApiTokenProvider
 *
 * @description
 * Assembles the plain personal API token verification use case.
 *
 * @type {FactoryProvider<VerifyApiToken>}
 */
export const verifyApiTokenProvider: FactoryProvider<VerifyApiToken> = {
  provide: VerifyApiToken,
  inject: [API_TOKEN_INTROSPECTOR],
  useFactory: (introspector: ApiTokenIntrospector): VerifyApiToken =>
    new VerifyApiToken(introspector),
};
