import type { FactoryProvider } from '@nestjs/common';

import { CheckBearerFailures } from '../../../../../rate-limit/public/addresses/check-bearer-failures.js';
import { CountBearerFailure } from '../../../../../rate-limit/public/addresses/count-bearer-failure.js';
import type { BearerFailureLimit } from '../../../../application/ports/outbound/rate-limit/api-token/bearer-failure-limit.port.js';
import { BEARER_FAILURE_LIMIT } from '../../../tokens/api-token/bearer-failure-limit.token.js';
import { createBearerFailureLimitAdapter } from '../../../../infrastructure/adapters/rate-limit/bearer-failure-limit.adapter.js';

/**
 * Constant bearerFailureLimitProvider
 *
 * @description
 * Binds the limit of the failed bearer-token authentications to the operations of `rate-limit`.
 *
 * @type {FactoryProvider<BearerFailureLimit>}
 */
export const bearerFailureLimitProvider: FactoryProvider<BearerFailureLimit> = {
  provide: BEARER_FAILURE_LIMIT,
  inject: [CheckBearerFailures, CountBearerFailure],
  useFactory: createBearerFailureLimitAdapter,
};
