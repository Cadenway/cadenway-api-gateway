import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { CountIntakeRequest } from '../../../../application/use-cases/commands/addresses/count-intake-request/count-intake-request.use-case.js';
import { RedisRequestCounter } from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';

const WRITES_PER_MINUTE = 10;

/** Creates independent counters for anonymous form reads, submissions, and upload mutations. */
export const countIntakeRequestProvider: FactoryProvider<CountIntakeRequest> = {
  provide: CountIntakeRequest,
  inject: [ResilientRedisClient, ADDRESS_PSEUDONYMIZER],
  useFactory: (redis: ResilientRedisClient, pseudonymizer: AddressPseudonymizer) =>
    new CountIntakeRequest(
      {
        read: new RedisRequestCounter(redis, {
          limit: 'intake-read',
          requests: 30,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
        submit: new RedisRequestCounter(redis, {
          limit: 'intake-submit',
          requests: WRITES_PER_MINUTE,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
        attachment: new RedisRequestCounter(redis, {
          limit: 'intake-attachment',
          requests: WRITES_PER_MINUTE,
          windowSeconds: 60,
          storeTimeoutMs: 100,
        }),
      },
      pseudonymizer,
    ),
};
