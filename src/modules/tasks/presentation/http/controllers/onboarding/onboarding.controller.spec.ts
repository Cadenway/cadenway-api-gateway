import type { Request, Response } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
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

import { attachVerifiedCredential } from '../../../../../../presentation/http/session/request-session.js';
import { GetOnboarding } from '../../../../application/use-cases/queries/onboarding/get-onboarding/get-onboarding.use-case.js';
import { UpdateOnboarding } from '../../../../application/use-cases/commands/onboarding/update-onboarding/update-onboarding.use-case.js';
import { UpdateOnboardingChecklist } from '../../../../application/use-cases/commands/onboarding/update-onboarding-checklist/update-onboarding-checklist.use-case.js';
import { FinishOnboarding } from '../../../../application/use-cases/commands/onboarding/finish-onboarding/finish-onboarding.use-case.js';
import type { TaskCollaborationRegistry } from '../../../../application/ports/outbound/task-service/approval/task-collaboration-registry.port.js';
import { OnboardingController } from './onboarding.controller.js';

describe('OnboardingController', () => {
  const userId = '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31';
  const spaceId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e05';
  const state = {
    version: 4,
    wizard: {
      status: 'finished',
      step: 'import',
      preset: 'blank',
      name: 'Produit',
      prefix: 'CAD',
      color: 'violet',
    },
    provisioning: { spaceId, firstListId: '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f20' },
    checklist: {
      presentation: 'expanded',
      firstTaskCreated: false,
      invitationSent: true,
      boardTried: false,
    },
  };

  function setup() {
    const registry = {
      getOnboarding: vi.fn().mockResolvedValue({ body: state, version: 4 }),
      updateOnboarding: vi.fn().mockResolvedValue({ body: state, version: 4 }),
      updateOnboardingChecklist: vi.fn().mockResolvedValue({ body: state, version: 4 }),
      finishOnboarding: vi.fn().mockResolvedValue({ body: state, version: 4 }),
    };
    const port = registry as unknown as TaskCollaborationRegistry;
    const controller = new OnboardingController(
      new GetOnboarding(port),
      new UpdateOnboarding(port),
      new UpdateOnboardingChecklist(port),
      new FinishOnboarding(port),
    );
    const request = {} as Request;
    attachVerifiedCredential(request, { kind: 'session', id: userId, userId });
    const setHeader = vi.fn();
    return {
      controller,
      registry,
      request,
      setHeader,
      response: { setHeader } as unknown as Response,
    };
  }

  it('uses the verified user, forwarding headers and returning the space location', async () => {
    const { controller, registry, request, response, setHeader } = setup();
    const input = { name: 'Produit', prefix: 'CAD', preset: 'blank' } as const;
    await expect(controller.finish(request, input, '"3"', 'finish-key', response)).resolves.toEqual(
      state,
    );
    expect(registry.finishOnboarding).toHaveBeenCalledWith(userId, input, '"3"', 'finish-key');
    expect(setHeader).toHaveBeenCalledWith('Location', `/v1/spaces/${spaceId}`);
    expect(setHeader).toHaveBeenCalledWith('ETag', '"4"');
    await controller.updateChecklist(request, { invitationSent: true }, '"3"', response);
    expect(registry.updateOnboardingChecklist).toHaveBeenCalledWith(
      userId,
      { invitationSent: true },
      '"3"',
    );
  });

  it('refuses an inconsistent upstream ETag or missing created space', async () => {
    const { controller, registry, request, response } = setup();
    vi.mocked(registry.getOnboarding).mockResolvedValueOnce({ body: state, version: 3 });
    await expect(controller.get(request, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    vi.mocked(registry.finishOnboarding).mockResolvedValueOnce({
      body: { ...state, provisioning: null },
      version: 4,
    });
    await expect(
      controller.finish(
        request,
        { name: 'Produit', prefix: 'CAD', preset: 'blank' },
        undefined,
        undefined,
        response,
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });
});

const finish = { name: 'Produit', prefix: 'CAD', preset: 'dev' };
const routes: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/me/onboarding',
    url: '/v1/me/onboarding',
    call: 'getOnboarding',
    scope: 'tasks:read',
    status: 200,
    calledWith: [CAMILLE.id],
    invalid: {},
  },
  {
    method: 'patch',
    path: '/v1/me/onboarding',
    url: '/v1/me/onboarding',
    call: 'updateOnboarding',
    scope: 'tasks:write',
    status: 200,
    body: { step: 'preset' },
    headers: { 'If-Match': '"3"' },
    calledWith: [CAMILLE.id, { step: 'preset' }, '"3"'],
    invalid: { body: { step: 'invalid' } },
    notRelayed: ['organization.role-forbidden'],
  },
  {
    method: 'patch',
    path: '/v1/me/onboarding/checklist',
    url: '/v1/me/onboarding/checklist',
    call: 'updateOnboardingChecklist',
    scope: 'tasks:write',
    status: 200,
    body: { invitationSent: true },
    headers: { 'If-Match': '"3"' },
    calledWith: [CAMILLE.id, { invitationSent: true }, '"3"'],
    invalid: { body: { invitationSent: false } },
    notRelayed: ['organization.role-forbidden'],
  },
  {
    method: 'post',
    path: '/v1/me/onboarding/finish',
    url: '/v1/me/onboarding/finish',
    call: 'finishOnboarding',
    scope: 'tasks:write',
    status: 201,
    body: finish,
    headers: { 'If-Match': '"3"', 'Idempotency-Key': 'finish-key' },
    calledWith: [CAMILLE.id, finish, '"3"', 'finish-key'],
    invalid: { body: { ...finish, prefix: '' } },
    check: (response) => {
      expect(response.headers.location).toBe('/v1/spaces/019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e05');
    },
  },
];
const cases: readonly RouteCase[] = routes.flatMap((route) =>
  taskRouteCases(route).filter(
    (item) =>
      !(route.method === 'get' && item.name.includes('refuses a request outside its contract')),
  ),
);

describe('onboarding HTTP routes', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;
  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });
  afterEach(() => vi.resetAllMocks());
  afterAll(async () => {
    await application.app.close();
  });
  it('covers every declared status', () => {
    expectEveryDeclaredStatus(cases);
  });
  it.each(cases.map((item) => [item.name, item] as const))('%s', async (_name, item) => {
    await runRouteCase(application, identity, item);
  });

  it('returns the current onboarding body when a prior ETag matches', async () => {
    const cookie = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;
    const first = await request(application.server).get('/v1/me/onboarding').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(first.headers.etag).toMatch(/^"\d+"$/u);

    const revalidated = await request(application.server)
      .get('/v1/me/onboarding')
      .set('Cookie', cookie)
      .set('If-None-Match', String(first.headers.etag));

    expect(revalidated.status).toBe(200);
    expect(revalidated.headers['cache-control']).toBe('private, no-store');
    expect(revalidated.headers.etag).toBe(first.headers.etag);
    expect(revalidated.body).toEqual(first.body);
    expect(application.task.getOnboarding).toHaveBeenCalledTimes(2);
  });

  describe.each(routes.filter((route) => route.method !== 'get'))(
    '$method $path organization precondition',
    (route) => {
      it('accepts the selected organization and forwards the original version', async () => {
        const response = await request(application.server)
          [route.method](route.url)
          .set({
            ...route.headers,
            Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`,
            Origin: ALLOWED_ORIGIN,
            'If-Organization-Match': ATELIER_NORD_ID.toUpperCase(),
          })
          .send(route.body as object);

        expect(response.status).toBe(route.status);
        expect(application.task[route.call]).toHaveBeenCalledWith(...route.calledWith);
      });

      it('rejects a stale organization before calling task-service', async () => {
        const response = await request(application.server)
          [route.method](route.url)
          .set({
            ...route.headers,
            Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`,
            Origin: ALLOWED_ORIGIN,
            'If-Organization-Match': '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31',
          })
          .send(route.body as object);

        expect(response.status).toBe(412);
        expect(response.body).toMatchObject({ code: 'organization.context-changed' });
        expect(application.task[route.call]).not.toHaveBeenCalled();
      });

      it('rejects a malformed organization before calling task-service', async () => {
        const response = await request(application.server)
          [route.method](route.url)
          .set({
            ...route.headers,
            Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`,
            Origin: ALLOWED_ORIGIN,
            'If-Organization-Match': 'invalid',
          })
          .send(route.body as object);

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ code: 'request.invalid' });
        expect(application.task[route.call]).not.toHaveBeenCalled();
      });
    },
  );
});
