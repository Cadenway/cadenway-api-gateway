import { ProblemException } from '@cadenway/nest-common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import {
  createFakeIdentity,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import { taskProblem } from '../../../../../../../tests/support/fake-task.js';
import { responseExample } from '../../../../../../../tests/support/public-contract.js';
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

/** Key of the task "Refondre l’écran de connexion SSO" of the contract examples. */
const TASK_KEY = 'CAD-482';

/** Path of the operation, as the spec writes it. */
const PATH = '/v1/tasks/{taskKey}/git-links';

/** The example page of the contract, the Git links of CAD-482. */
const PAGE = responseExample('get', PATH, 200) as Awaited<
  ReturnType<IntegrationServiceClient['listTaskGitLinks']>
>;

/** The `details` of `404 task.trashed`, as task-service answers them. */
const TRASHED = {
  key: TASK_KEY,
  name: 'Refondre l’écran de connexion SSO',
  entryId: '019a7006-7a8b-7c9d-8e0f-1a2b3c4d5e01',
  rootKey: TASK_KEY,
  trashedAt: '2026-11-06T16:20:00Z',
  trashedBy: { type: 'user', id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30' },
  purgeAt: '2026-12-06T16:20:00Z',
};

describe('GET /v1/tasks/{taskKey}/git-links', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  /** The route as the task route matrix exercises it: the task read comes first. */
  const route: TaskRoute = {
    method: 'get',
    path: PATH,
    url: `/v1/tasks/${TASK_KEY}/git-links?limit=20`,
    call: 'getTask',
    scope: 'tasks:read',
    status: 200,
    calledWith: [TASK_KEY],
    invalid: { url: `/v1/tasks/${TASK_KEY}/git-links?limit=0` },
    check: (response) => {
      expect(response.body).toEqual(PAGE);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(application.integration.listTaskGitLinks).toHaveBeenCalledExactlyOnceWith(TASK_KEY, {
        limit: 20,
      });
    },
  };

  /** The matrix cases, and the integration-service outcomes on a task the caller sees. */
  const cases = (): readonly RouteCase[] => [
    ...taskRouteCases(route).map((routeCase): RouteCase => ({
      ...routeCase,
      arrange: (fakes) => {
        application.integration.listTaskGitLinks.mockResolvedValue(PAGE);
        routeCase.arrange?.(fakes);
      },
      check: (response, fakes) => {
        routeCase.check?.(response, fakes);
        if (response.status !== 200) {
          expect(application.integration.listTaskGitLinks).not.toHaveBeenCalled();
        }
      },
    })),
    {
      name: 'relays the trash details of task-service without reading the links',
      method: 'get',
      path: PATH,
      url: `/v1/tasks/${TASK_KEY}/git-links`,
      arrange: ({ task }) =>
        task.getTask.mockRejectedValue(taskProblem(404, 'task.trashed', TRASHED)),
      status: 404,
      code: 'task.trashed',
      check: (response) => {
        expect((response.body as { details?: unknown }).details).toEqual(TRASHED);
        expect(application.integration.listTaskGitLinks).not.toHaveBeenCalled();
      },
    },
    {
      name: 'relays a cursor integration-service refuses as 400 request.invalid',
      method: 'get',
      path: PATH,
      url: `/v1/tasks/${TASK_KEY}/git-links?cursor=b3RoZXItdGFzaw`,
      arrange: () =>
        application.integration.listTaskGitLinks.mockRejectedValue(
          new ProblemException({
            status: 400,
            code: 'request.invalid',
            details: {
              issues: [{ in: 'query', path: 'cursor', code: 'invalid_format' }],
              service: 'integration-service',
            },
          }),
        ),
      status: 400,
      code: 'request.invalid',
      check: () => {
        expect(application.integration.listTaskGitLinks).toHaveBeenCalledWith(TASK_KEY, {
          cursor: 'b3RoZXItdGFzaw',
          limit: 50,
        });
      },
    },
    {
      name: 'answers an unavailable integration-service 503 naming it',
      method: 'get',
      path: PATH,
      url: `/v1/tasks/${TASK_KEY}/git-links`,
      arrange: () =>
        application.integration.listTaskGitLinks.mockRejectedValue(
          new ProblemException({
            status: 503,
            code: 'upstream.unavailable',
            details: { service: 'integration-service' },
          }),
        ),
      status: 503,
      code: 'upstream.unavailable',
      check: (response) => {
        expect((response.body as { details?: unknown }).details).toEqual({
          service: 'integration-service',
        });
      },
    },
    {
      name: 'answers a refused internal token of integration-service 503 upstream.unauthorized',
      method: 'get',
      path: PATH,
      url: `/v1/tasks/${TASK_KEY}/git-links`,
      arrange: () =>
        application.integration.listTaskGitLinks.mockRejectedValue(
          new ProblemException({
            status: 403,
            code: 'auth.organization-required',
            details: { service: 'integration-service' },
          }),
        ),
      status: 503,
      code: 'upstream.unauthorized',
    },
    {
      name: 'answers a page outside the public contract 503 upstream.failed',
      method: 'get',
      path: PATH,
      url: `/v1/tasks/${TASK_KEY}/git-links`,
      arrange: () =>
        application.integration.listTaskGitLinks.mockResolvedValue({
          items: [{ id: 'not-a-link' }],
          nextCursor: null,
        } as unknown as typeof PAGE),
      status: 503,
      code: 'upstream.failed',
    },
  ];

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

  it('exercises every status the operation declares', () => {
    expectEveryDeclaredStatus(cases());
  });

  it.each(cases().map((routeCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
