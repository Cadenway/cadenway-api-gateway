import type { FactoryProvider } from '@nestjs/common';

import { CheckBearerFailures } from '../../../../application/use-cases/queries/addresses/check-bearer-failures/check-bearer-failures.use-case.js';
import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';
import { BEARER_FAILURE_COUNTER } from '../../../tokens/addresses/bearer-failure-counter.token.js';

/**
 * Constant checkBearerFailuresProvider
 *
 * @description
 * Binds the plain use case to the counter of the failed bearer-token authentications and to the
 * address pseudonymizer.
 *
 * @type {FactoryProvider<CheckBearerFailures>}
 */
export const checkBearerFailuresProvider: FactoryProvider<CheckBearerFailures> = {
  provide: CheckBearerFailures,
  inject: [BEARER_FAILURE_COUNTER, ADDRESS_PSEUDONYMIZER],
  useFactory: (counter: RequestCounter, pseudonymizer: AddressPseudonymizer): CheckBearerFailures =>
    new CheckBearerFailures(counter, pseudonymizer),
};
