import { Writable } from 'node:stream';

import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types.js';
import { vi, type Mock } from 'vitest';

import { ROUTE_MODULES } from '../../src/app.module.js';
import { IdentityServiceClient } from '../../src/clients/identity-service.client.js';
import { OrganizationServiceClient } from '../../src/clients/organization-service.client.js';
import { createGatewayApplication } from '../../src/gateway-application.js';
import type { RequestCounter } from '../../src/modules/rate-limit/application/ports/outbound/counters/requests/request-counter.port.js';
import { ANONYMOUS_REQUEST_COUNTER } from '../../src/modules/rate-limit/composition/tokens/addresses/anonymous-request-counter.token.js';
import { BEARER_FAILURE_COUNTER } from '../../src/modules/rate-limit/composition/tokens/addresses/bearer-failure-counter.token.js';
import { REQUEST_COUNTER } from '../../src/modules/rate-limit/composition/tokens/requests/request-counter.token.js';
import type { FakeIdentity } from './fake-identity.js';
import { createFakeOrganization, type FakeOrganization } from './fake-organization.js';
import { testConfig } from './test-environment.js';

/**
 * Root module of the route tests: the route modules of the gateway (`ROUTE_MODULES`), with the
 * internal services and the request counters faked.
 */
@Module({})
class RouteTestModule {}

/**
 * The fake of one set of request counters: allows every request until a test says otherwise.
 */
export interface FakeCounter {
  /** Counts one request of a key. */
  readonly consume: Mock<RequestCounter['consume']>;
  /** Reads the counter of a key without counting. */
  readonly peek: Mock<RequestCounter['peek']>;
}

/**
 * The application of a route test.
 */
export interface RouteApplication {
  /** The application, initialized, not listening. */
  readonly app: NestExpressApplication;
  /** Its HTTP server, for supertest. */
  readonly server: App;
  /** Every log line written so far. */
  readonly logLines: string[];
  /** The fake of organization-service. */
  readonly organization: FakeOrganization;
  /** The fake of the counters of the sessions and personal API tokens. */
  readonly counter: FakeCounter;
  /** The fake of the counters of the requests without a credential, per client address. */
  readonly anonymousCounter: FakeCounter;
  /** The fake of the counters of the failed bearer-token authentications, per client address. */
  readonly bearerFailureCounter: FakeCounter;
}

/**
 * Creates a fake of the request counters that allows every request.
 *
 * @returns The fake.
 */
export function createFakeCounter(): FakeCounter {
  return {
    consume: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 })),
    peek: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 })),
  };
}

/**
 * Creates the gateway as `main.ts` does (the same `createGatewayApplication`: error format, trust
 * proxy, cookie-parser, CORS, organization context), with identity-service, organization-service
 * and the Redis counters of the rate limits replaced by fakes. The pseudonyms of the client
 * addresses are the real ones.
 *
 * @param fake - The fake of identity-service.
 * @param organization - The fake of organization-service; a fresh one when omitted.
 * @param counter - The fake of the counters of the credentials; one that allows everything when
 * omitted.
 * @returns The application and its log lines.
 */
export async function createRouteApplication(
  fake: FakeIdentity,
  organization: FakeOrganization = createFakeOrganization(),
  counter: FakeCounter = createFakeCounter(),
): Promise<RouteApplication> {
  const logLines: string[] = [];
  const sink: Writable = new Writable({
    write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
      logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
      done();
    },
  });
  const root: DynamicModule = {
    module: RouteTestModule,
    imports: [...ROUTE_MODULES],
  };
  const anonymousCounter: FakeCounter = createFakeCounter();
  const bearerFailureCounter: FakeCounter = createFakeCounter();
  const app: NestExpressApplication = await createGatewayApplication(testConfig(), sink, root);
  Object.assign(app.get(IdentityServiceClient), fake);
  Object.assign(app.get(OrganizationServiceClient), organization);
  Object.assign(app.get<symbol, RequestCounter>(REQUEST_COUNTER), counter);
  Object.assign(app.get<symbol, RequestCounter>(ANONYMOUS_REQUEST_COUNTER), anonymousCounter);
  Object.assign(app.get<symbol, RequestCounter>(BEARER_FAILURE_COUNTER), bearerFailureCounter);
  await app.init();
  return {
    app,
    server: app.getHttpServer() as App,
    logLines,
    organization,
    counter,
    anonymousCounter,
    bearerFailureCounter,
  };
}
