import type { FactoryProvider } from '@nestjs/common';

import { CountRequest } from '../../../../application/use-cases/commands/requests/count-request/count-request.use-case.js';
import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import { REQUEST_COUNTER } from '../../../tokens/requests/request-counter.token.js';

/**
 * Constant countRequestProvider
 *
 * @description
 * Binds the plain use case to the counter port in its owning module.
 *
 * @type {FactoryProvider<CountRequest>}
 */
export const countRequestProvider: FactoryProvider<CountRequest> = {
  provide: CountRequest,
  inject: [REQUEST_COUNTER],
  useFactory: (counter: RequestCounter): CountRequest => new CountRequest(counter),
};
