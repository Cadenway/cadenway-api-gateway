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

import { CreateTaskTimeEntry } from '../../../../application/use-cases/commands/time/create-task-time-entry/create-task-time-entry.use-case.js';
import { DeleteTaskTimeEntry } from '../../../../application/use-cases/commands/time/delete-task-time-entry/delete-task-time-entry.use-case.js';
import { ListTaskTimeEntries } from '../../../../application/use-cases/queries/time/list-task-time-entries/list-task-time-entries.use-case.js';
import { GetTaskTimeEntry } from '../../../../application/use-cases/queries/time/get-task-time-entry/get-task-time-entry.use-case.js';
import { GetTaskTimeSummary } from '../../../../application/use-cases/queries/time/get-task-time-summary/get-task-time-summary.use-case.js';
import { GetTaskStatusDurations } from '../../../../application/use-cases/queries/time/get-task-status-durations/get-task-status-durations.use-case.js';
import { TaskTimeController } from './task-time.controller.js';

const taskKey = 'CAD-482';
const entryId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b03';
const entry = {
  id: entryId,
  taskKey,
  authorUserId: '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31',
  minutes: 150,
  workDate: '2026-11-07',
  note: 'Review',
  createdAt: '2026-11-07T13:10:00Z',
};

/** Constructs the controller over a fake of the capability port. */
function setup(): {
  controller: TaskTimeController;
  registry: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    summary: ReturnType<typeof vi.fn>;
    durations: ReturnType<typeof vi.fn>;
  };
  setHeader: ReturnType<typeof vi.fn>;
  response: Response;
} {
  const registry = {
    list: vi
      .fn()
      .mockResolvedValue({ items: [entry], total: 1, totalMinutes: 150, nextCursor: null }),
    create: vi.fn().mockResolvedValue(entry),
    get: vi.fn().mockResolvedValue(entry),
    remove: vi.fn().mockResolvedValue(undefined),
    summary: vi.fn().mockResolvedValue({ totalMinutes: 150, estimateMinutes: null }),
    durations: vi.fn().mockResolvedValue({ summary: null }),
  };
  const setHeader = vi.fn();
  return {
    controller: new TaskTimeController(
      new ListTaskTimeEntries(registry),
      new CreateTaskTimeEntry(registry),
      new GetTaskTimeEntry(registry),
      new DeleteTaskTimeEntry(registry),
      new GetTaskTimeSummary(registry),
      new GetTaskStatusDurations(registry),
    ),
    registry,
    setHeader,
    response: { setHeader } as unknown as Response,
  };
}

describe('TaskTimeController', () => {
  it('forwards creation and the idempotency key, validating the public location', async () => {
    const { controller, registry, response, setHeader } = setup();
    const body = { minutes: 150, workDate: '2026-11-07' };
    await expect(controller.create({ taskKey }, body, 'entry-key', response)).resolves.toEqual(
      entry,
    );
    expect(registry.create).toHaveBeenCalledWith(taskKey, body, 'entry-key');
    expect(setHeader).toHaveBeenCalledWith(
      'Location',
      `/v1/tasks/${taskKey}/time-entries/${entryId}`,
    );
  });

  it('rejects a created entry from a different task', async () => {
    const { controller, registry, response } = setup();
    vi.mocked(registry.create).mockResolvedValue({ ...entry, taskKey: 'CAD-483' });
    await expect(
      controller.create({ taskKey }, { minutes: 1, workDate: '2026-11-07' }, undefined, response),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('relays pages, single entries, totals, durations and deletion', async () => {
    const { controller, registry } = setup();
    await expect(controller.list({ taskKey }, { limit: 20, cursor: 'cursor' })).resolves.toEqual({
      items: [entry],
      total: 1,
      totalMinutes: 150,
      nextCursor: null,
    });
    expect(registry.list).toHaveBeenCalledWith(taskKey, { limit: 20, cursor: 'cursor' });
    await expect(controller.get({ taskKey, timeEntryId: entryId })).resolves.toEqual(entry);
    await expect(controller.summary({ taskKey })).resolves.toEqual({
      totalMinutes: 150,
      estimateMinutes: null,
    });
    await expect(controller.durations({ taskKey })).resolves.toEqual({ summary: null });
    await expect(controller.remove({ taskKey, timeEntryId: entryId })).resolves.toBeUndefined();
    expect(registry.remove).toHaveBeenCalledWith(taskKey, entryId);
  });

  it('preserves the author refusal and rejects malformed upstream data', async () => {
    const { controller, registry } = setup();
    vi.mocked(registry.remove).mockRejectedValue(
      new ProblemException({
        status: 403,
        code: 'time-entry.author-required',
      }),
    );
    await expect(controller.remove({ taskKey, timeEntryId: entryId })).rejects.toMatchObject({
      problem: { status: 403, code: 'time-entry.author-required' },
    });
    vi.mocked(registry.summary).mockResolvedValue({ totalMinutes: -1, estimateMinutes: null });
    await expect(controller.summary({ taskKey })).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});

const routes: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/time-entries',
    url: `/v1/tasks/${taskKey}/time-entries?limit=20`,
    call: 'listTaskTimeEntries',
    scope: 'tasks:read',
    status: 200,
    calledWith: [taskKey, { limit: 20 }],
    invalid: { url: `/v1/tasks/${taskKey}/time-entries?limit=0` },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/time-entries',
    url: `/v1/tasks/${taskKey}/time-entries`,
    call: 'createTaskTimeEntry',
    scope: 'tasks:write',
    status: 201,
    body: { minutes: 150, workDate: '2026-11-07' },
    headers: { 'Idempotency-Key': 'time-key' },
    calledWith: [taskKey, { minutes: 150, workDate: '2026-11-07' }, 'time-key'],
    invalid: { body: { minutes: 0, workDate: '2026-11-07' } },
    check: (response) => {
      expect(response.headers.location).toBe(`/v1/tasks/${taskKey}/time-entries/${entryId}`);
    },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/time-entries/{timeEntryId}',
    url: `/v1/tasks/${taskKey}/time-entries/${entryId}`,
    call: 'getTaskTimeEntry',
    scope: 'tasks:read',
    status: 200,
    calledWith: [taskKey, entryId],
    invalid: { url: `/v1/tasks/${taskKey}/time-entries/invalid` },
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/time-entries/{timeEntryId}',
    url: `/v1/tasks/${taskKey}/time-entries/${entryId}`,
    call: 'deleteTaskTimeEntry',
    scope: 'tasks:write',
    status: 204,
    calledWith: [taskKey, entryId],
    invalid: { url: `/v1/tasks/${taskKey}/time-entries/invalid` },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/time-summary',
    url: `/v1/tasks/${taskKey}/time-summary`,
    call: 'getTaskTimeSummary',
    scope: 'tasks:read',
    status: 200,
    calledWith: [taskKey],
    invalid: { url: '/v1/tasks/invalid/time-summary' },
  },
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/status-durations',
    url: `/v1/tasks/${taskKey}/status-durations`,
    call: 'getTaskStatusDurations',
    scope: 'tasks:read',
    status: 200,
    calledWith: [taskKey],
    invalid: { url: '/v1/tasks/invalid/status-durations' },
  },
];
const cases: readonly RouteCase[] = routes.flatMap(taskRouteCases);

describe('task time routes', () => {
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
