import { Writable } from 'node:stream';

import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types.js';

import { ROUTE_MODULES } from '../../src/app.module.js';
import { createGatewayApplication } from '../../src/gateway-application.js';
import { fakeIdentityModule, type FakeIdentity } from './fake-identity.js';
import { testConfig } from './test-environment.js';

/**
 * Root module of the route tests: the route modules of the gateway (`ROUTE_MODULES`), without
 * Redis and with identity-service faked.
 */
@Module({})
class RouteTestModule {}

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
}

/**
 * Creates the gateway as `main.ts` does (the same `createGatewayApplication`: error format, trust
 * proxy, cookie-parser, CORS, organization context), with the routes of the authentication and
 * identity-service replaced by a fake.
 *
 * @param fake - The fake of identity-service.
 * @returns The application and its log lines.
 */
export async function createRouteApplication(fake: FakeIdentity): Promise<RouteApplication> {
  const logLines: string[] = [];
  const sink: Writable = new Writable({
    write(chunk: Buffer, _encoding: BufferEncoding, done: () => void): void {
      logLines.push(...chunk.toString('utf8').split('\n').filter(Boolean));
      done();
    },
  });
  const root: DynamicModule = {
    module: RouteTestModule,
    imports: [fakeIdentityModule(fake), ...ROUTE_MODULES],
  };
  const app: NestExpressApplication = await createGatewayApplication(testConfig(), sink, root);
  await app.init();
  return { app, server: app.getHttpServer() as App, logLines };
}
