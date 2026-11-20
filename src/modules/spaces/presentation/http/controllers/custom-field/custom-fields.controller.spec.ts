import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
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

import { CreateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/create-space-custom-field/create-space-custom-field.use-case.js';
import { RetireSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/retire-space-custom-field/retire-space-custom-field.use-case.js';
import { UpdateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/update-space-custom-field/update-space-custom-field.use-case.js';
import { GetSpaceCustomField } from '../../../../application/use-cases/queries/custom-field/get-space-custom-field/get-space-custom-field.use-case.js';
import { ListListCustomFields } from '../../../../application/use-cases/queries/custom-field/list-list-custom-fields/list-list-custom-fields.use-case.js';
import { ListSpaceCustomFields } from '../../../../application/use-cases/queries/custom-field/list-space-custom-fields/list-space-custom-fields.use-case.js';
import { CustomFieldsController } from './custom-fields.controller.js';

const spaceId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const listId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02';
const fieldId = '019a700a-1234-7567-89ab-cdef01234567';
const field = {
  id: fieldId,
  spaceId,
  name: 'Points',
  type: 'number',
  position: 0,
  sprintPoints: false,
  version: 2,
};

/** Constructs the controller with an isolated task-service port. */
function setup() {
  const registry = {
    listSpace: vi.fn().mockResolvedValue({ items: [field], nextCursor: null }),
    listList: vi.fn().mockResolvedValue({ items: [field], nextCursor: null }),
    create: vi.fn().mockResolvedValue({ field, version: 2 }),
    get: vi.fn().mockResolvedValue({ field, version: 2 }),
    update: vi.fn().mockResolvedValue({ field, version: 2 }),
    retire: vi.fn().mockResolvedValue(undefined),
  };
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as Response;
  const controller = new CustomFieldsController(
    new ListSpaceCustomFields(registry),
    new CreateSpaceCustomField(registry),
    new GetSpaceCustomField(registry),
    new UpdateSpaceCustomField(registry),
    new RetireSpaceCustomField(registry),
    new ListListCustomFields(registry),
  );
  return { controller, registry, response, setHeader };
}

describe('CustomFieldsController', () => {
  it('relays a creation key, validates the definition, and returns its location and ETag', async () => {
    const { controller, registry, response, setHeader } = setup();
    const body = { name: 'Points', type: 'number' as const };
    await expect(controller.create({ spaceId }, body, 'request-key', response)).resolves.toEqual(
      field,
    );
    expect(registry.create).toHaveBeenCalledWith(spaceId, body, 'request-key');
    expect(setHeader).toHaveBeenCalledWith(
      'Location',
      `/v1/spaces/${spaceId}/custom-fields/${fieldId}`,
    );
    expect(setHeader).toHaveBeenCalledWith('ETag', '"2"');
  });

  it('relays read, update, retirement and direct-list access with their parameters', async () => {
    const { controller, registry, response, setHeader } = setup();
    const query = { limit: 10, cursor: 'opaque' };
    await expect(controller.list({ spaceId }, query)).resolves.toEqual({
      items: [field],
      nextCursor: null,
    });
    await expect(controller.listForList({ listId }, query)).resolves.toEqual({
      items: [field],
      nextCursor: null,
    });
    await expect(controller.get({ spaceId, fieldId }, response)).resolves.toEqual(field);
    await expect(
      controller.update(
        { spaceId, fieldId },
        { position: 0, sprintPoints: false },
        '"2"',
        response,
      ),
    ).resolves.toEqual(field);
    await expect(controller.retire({ spaceId, fieldId }, '"2"')).resolves.toBeUndefined();
    expect(registry.listList).toHaveBeenCalledWith(listId, query);
    expect(registry.update).toHaveBeenCalledWith(
      spaceId,
      fieldId,
      { position: 0, sprintPoints: false },
      '"2"',
    );
    expect(registry.retire).toHaveBeenCalledWith(spaceId, fieldId, '"2"');
    expect(setHeader).toHaveBeenCalledWith('ETag', '"2"');
  });

  it('rejects a mismatched identity or version and preserves contract refusals', async () => {
    const { controller, registry, response } = setup();
    registry.get.mockResolvedValueOnce({ field: { ...field, spaceId: listId }, version: 2 });
    await expect(controller.get({ spaceId, fieldId }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    registry.update.mockResolvedValueOnce({ field, version: 3 });
    await expect(
      controller.update({ spaceId, fieldId }, {}, undefined, response),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    registry.retire.mockRejectedValueOnce(
      new ProblemException({ status: 412, code: 'request.version-mismatch' }),
    );
    await expect(controller.retire({ spaceId, fieldId }, '"1"')).rejects.toMatchObject({
      problem: { status: 412, code: 'request.version-mismatch' },
    });
  });
});

const routes: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/custom-fields',
    url: `/v1/spaces/${spaceId}/custom-fields?limit=20`,
    call: 'listSpaceCustomFields',
    scope: 'tasks:read',
    status: 200,
    calledWith: [spaceId, { limit: 20 }],
    invalid: { url: `/v1/spaces/${spaceId}/custom-fields?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/spaces/{spaceId}/custom-fields',
    url: `/v1/spaces/${spaceId}/custom-fields`,
    call: 'createSpaceCustomField',
    scope: 'tasks:write',
    status: 201,
    body: { name: 'Points', type: 'number' },
    headers: { 'Idempotency-Key': 'field-key' },
    calledWith: [spaceId, { name: 'Points', type: 'number' }, 'field-key'],
    invalid: { body: { name: '', type: 'number' } },
    check: (response) => {
      expect(response.headers.location).toBe(`/v1/spaces/${spaceId}/custom-fields/${fieldId}`);
      expect(response.headers.etag).toBe('"1"');
    },
  },
  {
    method: 'get',
    path: '/v1/spaces/{spaceId}/custom-fields/{fieldId}',
    url: `/v1/spaces/${spaceId}/custom-fields/${fieldId}`,
    call: 'getSpaceCustomField',
    scope: 'tasks:read',
    status: 200,
    calledWith: [spaceId, fieldId],
    invalid: { url: `/v1/spaces/${spaceId}/custom-fields/invalid` },
  },
  {
    method: 'patch',
    path: '/v1/spaces/{spaceId}/custom-fields/{fieldId}',
    url: `/v1/spaces/${spaceId}/custom-fields/${fieldId}`,
    call: 'updateSpaceCustomField',
    scope: 'tasks:write',
    status: 200,
    body: { sprintPoints: true },
    headers: { 'If-Match': '"2"' },
    calledWith: [spaceId, fieldId, { sprintPoints: true }, '"2"'],
    invalid: { body: { position: 30 } },
  },
  {
    method: 'delete',
    path: '/v1/spaces/{spaceId}/custom-fields/{fieldId}',
    url: `/v1/spaces/${spaceId}/custom-fields/${fieldId}`,
    call: 'retireSpaceCustomField',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"2"' },
    calledWith: [spaceId, fieldId, '"2"'],
    invalid: { url: `/v1/spaces/${spaceId}/custom-fields/invalid` },
  },
  {
    method: 'get',
    path: '/v1/lists/{listId}/custom-fields',
    url: `/v1/lists/${listId}/custom-fields?limit=20`,
    call: 'listListCustomFields',
    scope: 'tasks:read',
    status: 200,
    calledWith: [listId, { limit: 20 }],
    invalid: { url: `/v1/lists/${listId}/custom-fields?limit=0` },
  },
];
const cases: readonly RouteCase[] = routes.flatMap(taskRouteCases);

describe('custom field routes', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;
  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });
  afterEach(() => vi.resetAllMocks());
  afterAll(async () => application.app.close());
  it('covers every declared status', () => {
    expectEveryDeclaredStatus(cases);
  });
  it.each(cases.map((routeCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );
});
