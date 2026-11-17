import type { FactoryProvider } from '@nestjs/common';

import { VerifyApiToken } from '../../../../application/use-cases/commands/api-token/verify-api-token/verify-api-token.use-case.js';
import type { ApiTokenIntrospector } from '../../../../application/ports/outbound/identity/api-token/api-token-introspector.port.js';
import type { BearerFailureLimit } from '../../../../application/ports/outbound/rate-limit/api-token/bearer-failure-limit.port.js';
import { API_TOKEN_INTROSPECTOR } from '../../../tokens/api-token/api-token-introspector.token.js';
import { BEARER_FAILURE_LIMIT } from '../../../tokens/api-token/bearer-failure-limit.token.js';

/**
 * Constant verifyApiTokenProvider
 *
 * @description
 * Assembles the plain personal API token verification use case with the introspection and the
 * limit of the failed bearer-token authentications.
 *
 * @type {FactoryProvider<VerifyApiToken>}
 */
export const verifyApiTokenProvider: FactoryProvider<VerifyApiToken> = {
  provide: VerifyApiToken,
  inject: [API_TOKEN_INTROSPECTOR, BEARER_FAILURE_LIMIT],
  useFactory: (introspector: ApiTokenIntrospector, failures: BearerFailureLimit): VerifyApiToken =>
    new VerifyApiToken(introspector, failures),
};
