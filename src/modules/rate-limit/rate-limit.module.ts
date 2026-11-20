import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { addressPseudonymizerProvider } from './composition/providers/adapters/addresses/address-pseudonymizer.provider.js';
import { anonymousRequestCounterProvider } from './composition/providers/adapters/addresses/anonymous-request-counter.provider.js';
import { bearerFailureCounterProvider } from './composition/providers/adapters/addresses/bearer-failure-counter.provider.js';
import { requestCounterProvider } from './composition/providers/adapters/requests/request-counter.provider.js';
import { checkBearerFailuresProvider } from './composition/providers/use-cases/addresses/check-bearer-failures.provider.js';
import { countAnonymousRequestProvider } from './composition/providers/use-cases/addresses/count-anonymous-request.provider.js';
import { countIntakeRequestProvider } from './composition/providers/use-cases/addresses/count-intake-request.provider.js';
import { countBearerFailureProvider } from './composition/providers/use-cases/addresses/count-bearer-failure.provider.js';
import { countRequestProvider } from './composition/providers/use-cases/requests/count-request.provider.js';
import { CheckBearerFailures } from './public/addresses/check-bearer-failures.js';
import { CountAnonymousRequest } from './public/addresses/count-anonymous-request.js';
import { CountIntakeRequest } from './public/addresses/count-intake-request.js';
import { CountBearerFailure } from './public/addresses/count-bearer-failure.js';
import { CountRequest } from './public/requests/count-request.js';
import { RateLimitGuard } from './public/requests/rate-limit-guard.js';
import { IntakeRateLimitGuard } from './public/requests/intake-rate-limit-guard.js';

/**
 * Class RateLimitModule
 *
 * @description
 * The rate limits of the gateway, counted on the shared Redis of `RedisModule`: 600 requests per
 * minute per session or personal API token, 60 per minute per client address for the requests
 * without a credential, and 10 failed bearer-token authentications per minute per client address.
 * Exports `RateLimitGuard` for the route modules, with the `CountRequest` and
 * `CountAnonymousRequest` use cases it needs (a module that applies the guard instantiates it in
 * its own injector), and `CheckBearerFailures` and `CountBearerFailure` for the credential
 * guard of `auth`.
 */
@Module({
  imports: [RedisModule],
  providers: [
    requestCounterProvider,
    anonymousRequestCounterProvider,
    bearerFailureCounterProvider,
    addressPseudonymizerProvider,
    countRequestProvider,
    countAnonymousRequestProvider,
    countIntakeRequestProvider,
    checkBearerFailuresProvider,
    countBearerFailureProvider,
    RateLimitGuard,
    IntakeRateLimitGuard,
  ],
  exports: [
    RateLimitGuard,
    CountRequest,
    CountAnonymousRequest,
    CountIntakeRequest,
    IntakeRateLimitGuard,
    CheckBearerFailures,
    CountBearerFailure,
  ],
})
export class RateLimitModule {}
