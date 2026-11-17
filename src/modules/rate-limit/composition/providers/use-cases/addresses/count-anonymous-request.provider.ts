import type { FactoryProvider } from '@nestjs/common';

import { CountAnonymousRequest } from '../../../../application/use-cases/commands/addresses/count-anonymous-request/count-anonymous-request.use-case.js';
import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../../../tokens/addresses/anonymous-request-counter.token.js';

/**
 * Constant countAnonymousRequestProvider
 *
 * @description
 * Binds the plain use case to the counter of the requests without a credential and to the
 * address pseudonymizer.
 *
 * @type {FactoryProvider<CountAnonymousRequest>}
 */
export const countAnonymousRequestProvider: FactoryProvider<CountAnonymousRequest> = {
  provide: CountAnonymousRequest,
  inject: [ANONYMOUS_REQUEST_COUNTER, ADDRESS_PSEUDONYMIZER],
  useFactory: (
    counter: RequestCounter,
    pseudonymizer: AddressPseudonymizer,
  ): CountAnonymousRequest => new CountAnonymousRequest(counter, pseudonymizer),
};
