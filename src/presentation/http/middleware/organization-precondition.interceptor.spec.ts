import {
  ArchiveTaskInternalResponse,
  GetTaskInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import { requireOrganizationId } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
  TASKS_TOKEN,
} from '../../../../tests/support/fake-identity.js';
import { ATELIER_NORD } from '../../../../tests/support/fake-organization.js';
import { internalExample } from '../../../../tests/support/fake-task.js';
import { expectPublicResponse } from '../../../../tests/support/public-contract.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN } from '../../../../tests/support/test-environment.js';

const OTHER_ORGANIZATION_ID = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const OTHER_ORGANIZATION_SESSION = {
  ...CAMILLE_ORGANIZATION_SESSION,
  organizationId: OTHER_ORGANIZATION_ID,
};
const SESSION_COOKIE = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;
const TASK_KEY = 'CAD-482';
const TASK_URL = `/v1/tasks/${TASK_KEY}`;
const ARCHIVE_URL = `${TASK_URL}/archive`;

describe('organization preconditions at the public HTTP edge', () => {
  const identity = createFakeIdentity();
  let application: RouteApplication;

  beforeAll(async () => {
    application = await createRouteApplication(identity);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await application.app.close();
  });

  it.each([
    ['getSpace', '/v1/spaces/019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02'],
    ['getList', '/v1/lists/019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e03'],
    [
      'countTaskGroups',
      '/v1/lists/019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e03/task-groups?groupBy=status',
    ],
    ['listTasks', '/v1/lists/019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e03/tasks'],
  ] as const)('rejects a stale organization before the board read %s', async (operation, path) => {
    identity.introspect.mockResolvedValue(OTHER_ORGANIZATION_SESSION);

    const stale = await request(application.server)
      .get(path)
      .set('Cookie', SESSION_COOKIE)
      .set('If-Organization-Match', ATELIER_NORD_ID);

    expectOrganizationChanged(stale);
    expect(application.task[operation]).not.toHaveBeenCalled();

    const current = await request(application.server)
      .get(path)
      .set('Cookie', SESSION_COOKIE)
      .set('If-Organization-Match', OTHER_ORGANIZATION_ID);
    expect(current.status).toBe(200);
    expect(application.task[operation]).toHaveBeenCalledOnce();
  });

  it('reads same-version homonyms afresh when the same session switches organizations', async () => {
    const task = internalExample(GetTaskInternalResponse, 'get', '/v1/tasks/{taskKey}');
    identity.introspect
      .mockResolvedValueOnce(CAMILLE_ORGANIZATION_SESSION)
      .mockResolvedValueOnce(OTHER_ORGANIZATION_SESSION)
      .mockResolvedValueOnce(OTHER_ORGANIZATION_SESSION);
    application.task.getTask.mockImplementation(() =>
      Promise.resolve({
        ...task,
        name:
          requireOrganizationId() === ATELIER_NORD_ID
            ? 'Task in Atelier Nord'
            : 'Task in Studio Sud',
      }),
    );

    const first = await request(application.server).get(TASK_URL).set('Cookie', SESSION_COOKIE);
    const etag = `"${String(task.version)}"`;
    expectPublicResponse('get', '/v1/tasks/{taskKey}', first);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(first.headers.etag).toBe(etag);
    expect(first.body).toMatchObject({ name: 'Task in Atelier Nord', version: task.version });

    const stale = await request(application.server)
      .get(TASK_URL)
      .set('Cookie', SESSION_COOKIE)
      .set('If-None-Match', etag)
      .set('If-Organization-Match', ATELIER_NORD_ID);
    expectOrganizationChanged(stale);
    expect(application.task.getTask).toHaveBeenCalledTimes(1);

    const second = await request(application.server)
      .get(TASK_URL)
      .set('Cookie', SESSION_COOKIE)
      .set('If-None-Match', etag);
    expectPublicResponse('get', '/v1/tasks/{taskKey}', second);
    expect(second.status).toBe(200);
    expect(second.headers['cache-control']).toBe('private, no-store');
    expect(second.headers.etag).toBe(etag);
    expect(second.body).toMatchObject({ name: 'Task in Studio Sud', version: task.version });
    expect(application.task.getTask).toHaveBeenCalledTimes(2);
  });

  it('keeps current organization reads private and leaves the numeric write precondition available', async () => {
    identity.introspect.mockResolvedValue(OTHER_ORGANIZATION_SESSION);
    application.organization.getOrganization.mockResolvedValue({
      ...ATELIER_NORD,
      id: OTHER_ORGANIZATION_ID,
      name: 'Studio Sud',
    });
    const etag = `"${String(ATELIER_NORD.version)}"`;

    const stale = await request(application.server)
      .get('/v1/organization')
      .set('Cookie', SESSION_COOKIE)
      .set('If-Organization-Match', ATELIER_NORD_ID);
    expectOrganizationChanged(stale);
    expect(application.organization.getOrganization).not.toHaveBeenCalled();

    const current = await request(application.server)
      .get('/v1/organization')
      .set('Cookie', SESSION_COOKIE)
      .set('If-None-Match', etag);
    expectPublicResponse('get', '/v1/organization', current);
    expect(current.status).toBe(200);
    expect(current.headers['cache-control']).toBe('private, no-store');
    expect(current.headers.etag).toBe(etag);
    expect(current.body).toMatchObject({ id: OTHER_ORGANIZATION_ID, name: 'Studio Sud' });
  });

  it('refuses stale archive requests and preserves the matching organization and If-Match', async () => {
    identity.introspect.mockResolvedValue(OTHER_ORGANIZATION_SESSION);
    const archived = internalExample(
      ArchiveTaskInternalResponse,
      'post',
      '/v1/tasks/{taskKey}/archive',
    );
    application.task.archiveTask.mockImplementation(() => {
      expect(requireOrganizationId()).toBe(OTHER_ORGANIZATION_ID);
      return Promise.resolve(archived);
    });

    const stale = await request(application.server)
      .post(ARCHIVE_URL)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', SESSION_COOKIE)
      .set('If-Organization-Match', ATELIER_NORD_ID)
      .set('If-Match', '"12"')
      .send({});
    expectOrganizationChanged(stale);
    expect(application.task.archiveTask).not.toHaveBeenCalled();
    expect(application.counter.consume).toHaveBeenCalledTimes(1);

    const current = await request(application.server)
      .post(ARCHIVE_URL)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', SESSION_COOKIE)
      .set('If-Organization-Match', OTHER_ORGANIZATION_ID.toUpperCase())
      .set('If-Match', '"12"')
      .send({});
    expectPublicResponse('post', '/v1/tasks/{taskKey}/archive', current);
    expect(current.status).toBe(200);
    expect(application.task.archiveTask).toHaveBeenCalledExactlyOnceWith(TASK_KEY, {}, '"12"');
  });

  it.each([
    {
      name: 'a missing session',
      headers: {},
      status: 401,
      code: 'auth.session-required',
    },
    {
      name: 'a cross-site session request',
      headers: { Cookie: SESSION_COOKIE, Origin: 'https://outside.example' },
      status: 403,
      code: 'auth.csrf-rejected',
    },
    {
      name: 'a bearer token without the write scope',
      headers: { Authorization: `Bearer ${TASKS_TOKEN}` },
      status: 403,
      code: 'auth.scope-missing',
    },
  ])('refuses $name before examining the precondition', async ({ headers, status, code }) => {
    const result = await request(application.server)
      .post(ARCHIVE_URL)
      .set({ Origin: ALLOWED_ORIGIN, ...headers, 'If-Organization-Match': 'not-a-uuid' })
      .send({});

    expectPublicResponse('post', '/v1/tasks/{taskKey}/archive', result);
    expect(result.status).toBe(status);
    expect(result.body).toMatchObject({ code });
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(application.task.archiveTask).not.toHaveBeenCalled();
  });

  it('keeps a malformed request private before the JSON parser can return', async () => {
    const result = await request(application.server)
      .post(ARCHIVE_URL)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', SESSION_COOKIE)
      .set('Content-Type', 'application/json')
      .send('{');

    expectPublicResponse('post', '/v1/tasks/{taskKey}/archive', result);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ code: 'request.invalid' });
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(application.task.archiveTask).not.toHaveBeenCalled();
  });
});

/** Uses the installed problem schema shared by all organization preconditions. */
function expectOrganizationChanged(response: request.Response): void {
  expectPublicResponse('get', '/v1/tasks/{taskKey}/detail', response);
  expect(response.status).toBe(412);
  expect(response.body).toEqual({
    type: 'about:blank',
    title: 'L’organisation active a changé.',
    status: 412,
    code: 'organization.context-changed',
  });
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.headers.etag).toBeUndefined();
}
