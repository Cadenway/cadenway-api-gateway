import type { FactoryProvider } from '@nestjs/common';

import { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import type { ApiTokenIntrospector } from '../../../../application/ports/outbound/identity/api-token/api-token-introspector.port.js';
import { API_TOKEN_INTROSPECTOR } from '../../../tokens/api-token/api-token-introspector.token.js';
import { createApiTokenIntrospectorAdapter } from '../../../../infrastructure/adapters/identity/api-token-introspector.adapter.js';

/**
 * Constant apiTokenIntrospectorProvider
 *
 * @description
 * Owns the outbound port binding for this capability.
 *
 * @type {FactoryProvider<ApiTokenIntrospector>}
 */
export const apiTokenIntrospectorProvider: FactoryProvider<ApiTokenIntrospector> = {
  provide: API_TOKEN_INTROSPECTOR,
  inject: [IdentityServiceClient],
  useFactory: createApiTokenIntrospectorAdapter,
};
