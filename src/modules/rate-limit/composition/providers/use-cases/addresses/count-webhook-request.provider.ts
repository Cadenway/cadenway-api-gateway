import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import {
  CountWebhookRequest,
  WEBHOOK_REQUESTS_PER_MINUTE,
} from '../../../../application/use-cases/commands/addresses/count-webhook-request/count-webhook-request.use-case.js';
import { RedisRequestCounter } from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';

/** Creates provider-specific Redis counters with the bounded in-memory outage fallback. */
export const countWebhookRequestProvider: FactoryProvider<CountWebhookRequest> = {
  provide: CountWebhookRequest,
  inject: [ResilientRedisClient, ADDRESS_PSEUDONYMIZER],
  useFactory: (redis: ResilientRedisClient, pseudonymizer: AddressPseudonymizer) =>
    new CountWebhookRequest(
      {
        github: new RedisRequestCounter(redis, {
          limit: 'webhook-github',
          requests: WEBHOOK_REQUESTS_PER_MINUTE,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
        gitlab: new RedisRequestCounter(redis, {
          limit: 'webhook-gitlab',
          requests: WEBHOOK_REQUESTS_PER_MINUTE,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
      },
      pseudonymizer,
    ),
};
