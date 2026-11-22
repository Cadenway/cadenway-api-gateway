import { ResilientRedisClient } from '@cadenway/nest-common/redis';
import type { FactoryProvider } from '@nestjs/common';

import type { RequestCounter } from '../../../../application/ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../application/ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';
import { AdmitIntrospection } from '../../../../application/use-cases/commands/addresses/admit-introspection/admit-introspection.use-case.js';
import { RedisRequestCounter } from '../../../../infrastructure/adapters/redis/redis-request-counter.adapter.js';
import { ADDRESS_PSEUDONYMIZER } from '../../../tokens/addresses/address-pseudonymizer.token.js';

/** Shared fixed-window bucket for candidate credentials before the call to Identity. */
export const INTROSPECTION_COUNTER: unique symbol = Symbol('IntrospectionCounter');

/** Keeps the address ceiling above a single credential's normal request allowance. */
export const introspectionCounterProvider: FactoryProvider<RequestCounter> = {
  provide: INTROSPECTION_COUNTER,
  inject: [ResilientRedisClient],
  useFactory: (redis: ResilientRedisClient): RequestCounter =>
    new RedisRequestCounter(redis, {
      limit: 'introspection',
      requests: 1200,
      windowSeconds: 60,
      storeTimeoutMs: 100,
    }),
};

/** Shares one concurrency limiter among every route module in this process. */
export const admitIntrospectionProvider: FactoryProvider<AdmitIntrospection> = {
  provide: AdmitIntrospection,
  inject: [INTROSPECTION_COUNTER, ADDRESS_PSEUDONYMIZER],
  useFactory: (counter: RequestCounter, pseudonymizer: AddressPseudonymizer): AdmitIntrospection =>
    new AdmitIntrospection(counter, pseudonymizer),
};
