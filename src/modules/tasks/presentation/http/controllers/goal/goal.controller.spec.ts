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

import type { GoalRegistry } from '../../../../application/ports/outbound/task-service/goal/goal-registry.port.js';
import { CreateGoal } from '../../../../application/use-cases/commands/goal/create-goal/create-goal.use-case.js';
import { CreateGoalResult } from '../../../../application/use-cases/commands/goal/create-goal-result/create-goal-result.use-case.js';
import { DeleteGoal } from '../../../../application/use-cases/commands/goal/delete-goal/delete-goal.use-case.js';
import { DeleteGoalResult } from '../../../../application/use-cases/commands/goal/delete-goal-result/delete-goal-result.use-case.js';
import { UpdateGoal } from '../../../../application/use-cases/commands/goal/update-goal/update-goal.use-case.js';
import { UpdateGoalResult } from '../../../../application/use-cases/commands/goal/update-goal-result/update-goal-result.use-case.js';
import { GetGoal } from '../../../../application/use-cases/queries/goal/get-goal/get-goal.use-case.js';
import { GetGoalResult } from '../../../../application/use-cases/queries/goal/get-goal-result/get-goal-result.use-case.js';
import { ListGoals } from '../../../../application/use-cases/queries/goal/list-goals/list-goals.use-case.js';
import { GoalController } from './goal.controller.js';

const goalId = '019a7008-8b9c-7d0e-8f1a-2b3c4d5e6f01';
const resultId = '019a7008-8b9c-7d0e-8f1a-2b3c4d5e6f02';
const ownerUserId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30';
const today = '2026-11-08';
const goal = {
  id: goalId,
  name: 'Objectif',
  ownerUserId,
  dueDate: '2026-12-31',
  spaceId: null,
  quarter: '2026-Q4',
  version: 3,
  progressPercent: 0,
  health: 'on-track',
  results: [],
};
const result = {
  id: resultId,
  label: 'Terminé',
  kind: 'checkbox' as const,
  checked: false,
  progressPercent: 0,
};

function setup() {
  const registry = {
    listGoals: vi.fn(),
    createGoal: vi.fn().mockResolvedValue({ body: goal, version: 3 }),
    getGoal: vi.fn().mockResolvedValue({ body: goal, version: 3 }),
    updateGoal: vi.fn().mockResolvedValue({ body: goal, version: 3 }),
    deleteGoal: vi.fn().mockResolvedValue(undefined),
    createGoalResult: vi.fn().mockResolvedValue({ body: result, version: 3 }),
    getGoalResult: vi.fn().mockResolvedValue({ body: result, version: 3 }),
    updateGoalResult: vi.fn().mockResolvedValue({ body: result, version: 3 }),
    deleteGoalResult: vi.fn().mockResolvedValue(undefined),
  };
  const port: GoalRegistry = registry;
  const controller = new GoalController(
    new ListGoals(port),
    new CreateGoal(port),
    new GetGoal(port),
    new UpdateGoal(port),
    new DeleteGoal(port),
    new CreateGoalResult(port),
    new GetGoalResult(port),
    new UpdateGoalResult(port),
    new DeleteGoalResult(port),
  );
  const setHeader = vi.fn();
  return { controller, registry, setHeader, response: { setHeader } as unknown as Response };
}

describe('GoalController', () => {
  it('forwards conditional and idempotency headers and maps canonical locations', async () => {
    const { controller, registry, response, setHeader } = setup();
    const request = { name: 'Objectif', ownerUserId, dueDate: '2026-12-31', quarter: '2026-Q4' };
    await expect(controller.create({ today }, request, 'create-key', response)).resolves.toEqual(
      goal,
    );
    expect(registry.createGoal).toHaveBeenCalledWith(today, request, 'create-key');
    expect(setHeader).toHaveBeenCalledWith('Location', `/v1/goals/${goalId}?today=${today}`);
    await controller.createResult(
      { goalId },
      { kind: 'checkbox', label: 'Terminé', checked: false },
      '"2"',
      'result-key',
      response,
    );
    expect(registry.createGoalResult).toHaveBeenCalledWith(
      goalId,
      { kind: 'checkbox', label: 'Terminé', checked: false },
      '"2"',
      'result-key',
    );
    expect(setHeader).toHaveBeenCalledWith('Location', `/v1/goals/${goalId}/results/${resultId}`);
    expect(setHeader).toHaveBeenCalledWith('ETag', '"3"');
  });

  it('refuses blank conditions and an inconsistent upstream goal before returning it', async () => {
    const { controller, registry, response } = setup();
    await expect(controller.delete({ goalId }, ' ')).rejects.toMatchObject({
      problem: { status: 400, code: 'request.invalid' },
    });
    expect(registry.deleteGoal).not.toHaveBeenCalled();
    registry.getGoal.mockResolvedValueOnce({ body: { ...goal, version: 4 }, version: 3 });
    await expect(controller.get({ goalId }, { today }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('masks refusals outside the specific public operation', async () => {
    const { controller, registry } = setup();
    registry.deleteGoalResult.mockRejectedValueOnce(
      new ProblemException({ status: 422, code: 'goal.result-patch-invalid' }),
    );
    await expect(controller.deleteResult({ goalId, resultId }, undefined)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});

const creation = { name: 'Objectif', ownerUserId, dueDate: '2026-12-31', quarter: '2026-Q4' };
const resultCreation = { kind: 'checkbox', label: 'Terminé', checked: false };
const entries: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/goals',
    url: `/v1/goals?quarter=2026-Q4&today=${today}`,
    call: 'listGoals',
    scope: 'tasks:read',
    status: 200,
    calledWith: [{ quarter: '2026-Q4', today, limit: 50 }],
    invalid: { url: `/v1/goals?quarter=invalid&today=${today}` },
  },
  {
    method: 'post',
    path: '/v1/goals',
    url: `/v1/goals?today=${today}`,
    call: 'createGoal',
    scope: 'tasks:write',
    status: 201,
    body: creation,
    headers: { 'Idempotency-Key': 'goal-key' },
    calledWith: [creation, { today }, 'goal-key'],
    invalid: { body: { ...creation, name: '' } },
  },
  {
    method: 'get',
    path: '/v1/goals/{goalId}',
    url: `/v1/goals/${goalId}?today=${today}`,
    call: 'getGoal',
    scope: 'tasks:read',
    status: 200,
    calledWith: [goalId, { today }],
    invalid: { url: `/v1/goals/invalid?today=${today}` },
  },
  {
    method: 'patch',
    path: '/v1/goals/{goalId}',
    url: `/v1/goals/${goalId}?today=${today}`,
    call: 'updateGoal',
    scope: 'tasks:write',
    status: 200,
    body: { name: 'Autre' },
    headers: { 'If-Match': '"2"' },
    calledWith: [goalId, { name: 'Autre' }, { today }, '"2"'],
    invalid: { body: { name: '' } },
  },
  {
    method: 'delete',
    path: '/v1/goals/{goalId}',
    url: `/v1/goals/${goalId}`,
    call: 'deleteGoal',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"2"' },
    calledWith: [goalId, '"2"'],
    invalid: { url: '/v1/goals/invalid' },
  },
  {
    method: 'post',
    path: '/v1/goals/{goalId}/results',
    url: `/v1/goals/${goalId}/results`,
    call: 'createGoalResult',
    scope: 'tasks:write',
    status: 201,
    body: resultCreation,
    headers: { 'If-Match': '"2"', 'Idempotency-Key': 'result-key' },
    calledWith: [goalId, resultCreation, '"2"', 'result-key'],
    invalid: { body: { kind: 'unknown' } },
  },
  {
    method: 'get',
    path: '/v1/goals/{goalId}/results/{resultId}',
    url: `/v1/goals/${goalId}/results/${resultId}`,
    call: 'getGoalResult',
    scope: 'tasks:read',
    status: 200,
    calledWith: [goalId, resultId],
    invalid: { url: `/v1/goals/${goalId}/results/invalid` },
  },
  {
    method: 'patch',
    path: '/v1/goals/{goalId}/results/{resultId}',
    url: `/v1/goals/${goalId}/results/${resultId}`,
    call: 'updateGoalResult',
    scope: 'tasks:write',
    status: 200,
    body: { checked: true },
    headers: { 'If-Match': '"2"' },
    calledWith: [goalId, resultId, { checked: true }, '"2"'],
    invalid: { body: { checked: 'yes' } },
  },
  {
    method: 'delete',
    path: '/v1/goals/{goalId}/results/{resultId}',
    url: `/v1/goals/${goalId}/results/${resultId}`,
    call: 'deleteGoalResult',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"2"' },
    calledWith: [goalId, resultId, '"2"'],
    invalid: { url: `/v1/goals/${goalId}/results/invalid` },
  },
];

const cases: readonly RouteCase[] = entries.flatMap((entry) =>
  taskRouteCases(entry).map((item) => {
    if (item.status !== entry.status) return item;
    return {
      ...item,
      arrange: ({ task }) => {
        if (entry.call === 'listGoals') {
          task.listGoals.mockResolvedValue({
            items: [],
            nextCursor: null,
            summary: {
              goalCount: 0,
              expectedProgressPercent: 40,
              averageProgressPercent: 0,
              onTrackOrAchievedCount: 0,
              achievedCount: 0,
              atRiskOrBehindCount: 0,
            },
          });
        } else if (entry.call === 'deleteGoal' || entry.call === 'deleteGoalResult') {
          task[entry.call].mockResolvedValue(undefined);
        } else if (
          entry.call === 'createGoalResult' ||
          entry.call === 'getGoalResult' ||
          entry.call === 'updateGoalResult'
        ) {
          task[entry.call].mockResolvedValue({ body: result, version: 3 });
        } else if (
          entry.call === 'createGoal' ||
          entry.call === 'getGoal' ||
          entry.call === 'updateGoal'
        ) {
          task[entry.call].mockResolvedValue({ body: goal, version: 3 });
        }
      },
    };
  }),
);

describe('goal HTTP routes', () => {
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
});
