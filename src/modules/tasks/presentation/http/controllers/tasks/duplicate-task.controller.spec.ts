import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, it, vi, expect } from 'vitest';
import {
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import {
  expectEveryDeclaredStatus,
  runRouteCase,
  type RouteCase,
} from '../../../../../../../tests/support/route-cases.js';
import {
  taskRouteCases,
  type TaskRoute,
} from '../../../../../../../tests/support/task-route-matrix.js';
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';

/** Resource identifier from the contract. */
const ID = 'CAD-482';
/** Route exercised against the public contract. */
const ROUTE: TaskRoute = {
  method: 'post',
  path: '/v1/tasks/{taskKey}/duplicate',
  url: `/v1/tasks/${ID}/duplicate`,
  call: 'duplicateTask',
  scope: 'tasks:write',
  status: 201,
  body: {},
  headers: { 'If-Match': '"2"', 'Idempotency-Key': 'copy-key' },
  calledWith: [ID, {}, '"2"', 'copy-key'],
  invalid: { body: { extra: true } },
  check: (response) => {
    expect(response.headers.etag).toBe(
      `"${String((response.body as { version: number }).version)}"`,
    );
    expect(response.headers.location).toBe(`/v1/tasks/${(response.body as { key: string }).key}`);
  },
};
/** Cases expanded from the contract. */
const CASES: readonly RouteCase[] = taskRouteCases(ROUTE);

/** Sends chunked bytes through the same HTTP server and parser as a public route. */
async function sendChunked(
  application: RouteApplication,
  body?: string,
): Promise<{ status: number; body: unknown }> {
  const server: Server = application.app.getHttpServer();
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address() as AddressInfo;
    return await new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: `/v1/tasks/${ID}/duplicate`,
          agent: false,
          headers: {
            Connection: 'close',
            Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`,
            Origin: ALLOWED_ORIGIN,
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          },
        },
        (incoming) => {
          let text = '';
          incoming.setEncoding('utf8');
          incoming.on('data', (chunk: string) => {
            text += chunk;
          });
          incoming.on('end', () => {
            resolve({ status: incoming.statusCode ?? 0, body: JSON.parse(text) as unknown });
          });
        },
      );
      outgoing.on('error', reject);
      outgoing.end(body);
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  }
}

describe('duplicate-task route', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;
  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });
  afterEach(() => {
    vi.resetAllMocks();
  });
  afterAll(async () => {
    await application.app.close();
  });
  it('covers every declared status', () => {
    expectEveryDeclaredStatus(CASES);
  });
  it('rejects an empty chunked body and accepts a literal JSON object', async () => {
    expect(await sendChunked(application)).toMatchObject({
      status: 400,
      body: {
        code: 'request.invalid',
        details: { issues: [{ in: 'body', path: '', code: 'required' }] },
      },
    });
    expect(application.task.duplicateTask).not.toHaveBeenCalled();

    expect(await sendChunked(application, '{}')).toMatchObject({ status: 201 });
    expect(application.task.duplicateTask).toHaveBeenCalledOnce();
  });
  it.each(CASES.map((routeCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
