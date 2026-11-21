import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import {
  CountSiteRequest,
  SITE_REQUEST_QUOTAS,
} from '../../../../application/use-cases/commands/addresses/count-site-request/count-site-request.use-case.js';
import { RedisRequestCounter } from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';

/** Builds independent Redis-backed contact and newsletter windows. */
export const countSiteRequestProvider: FactoryProvider<CountSiteRequest> = {
  provide: CountSiteRequest,
  inject: [ResilientRedisClient, ADDRESS_PSEUDONYMIZER],
  useFactory: (redis: ResilientRedisClient, pseudonymizer: AddressPseudonymizer) =>
    new CountSiteRequest(
      {
        contact: new RedisRequestCounter(redis, {
          limit: 'site-contact',
          requests: SITE_REQUEST_QUOTAS.contact,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
        newsletter: new RedisRequestCounter(redis, {
          limit: 'site-newsletter',
          requests: SITE_REQUEST_QUOTAS.newsletter,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
      },
      pseudonymizer,
    ),
};
