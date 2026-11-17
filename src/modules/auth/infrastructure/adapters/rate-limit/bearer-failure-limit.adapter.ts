import type { BearerFailureLimit } from '../../../application/ports/outbound/rate-limit/api-token/bearer-failure-limit.port.js';
import type {
  CheckBearerFailures,
  RequestAllowance,
} from '../../../../rate-limit/public/addresses/check-bearer-failures.js';
import type { CountBearerFailure } from '../../../../rate-limit/public/addresses/count-bearer-failure.js';

/**
 * Function createBearerFailureLimitAdapter
 *
 * @description
 * Binds the local port to the operations the `rate-limit` capability publishes for it.
 *
 * @param {CheckBearerFailures} check - Reads the failed bearer authentications of an address.
 * @param {CountBearerFailure} count - Counts one failed bearer authentication of an address.
 * @returns {BearerFailureLimit} Local adapter for the capability.
 */
export function createBearerFailureLimitAdapter(
  check: CheckBearerFailures,
  count: CountBearerFailure,
): BearerFailureLimit {
  return {
    secondsUntilAllowed: async (clientAddress: string): Promise<number> => {
      const allowance: RequestAllowance = await check.execute({ clientAddress });
      return allowance.allowed ? 0 : allowance.retryAfterSeconds;
    },
    countFailure: (clientAddress: string): Promise<void> => count.execute({ clientAddress }),
  };
}
