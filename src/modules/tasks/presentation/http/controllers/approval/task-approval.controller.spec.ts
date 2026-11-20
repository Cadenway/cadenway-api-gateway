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

import { GetTaskApproval } from '../../../../application/use-cases/queries/approval/get-task-approval/get-task-approval.use-case.js';
import { RequestTaskApproval } from '../../../../application/use-cases/commands/approval/request-task-approval/request-task-approval.use-case.js';
import { VoteOnTaskApproval } from '../../../../application/use-cases/commands/approval/vote-on-task-approval/vote-on-task-approval.use-case.js';
import { WithdrawTaskApprovalVote } from '../../../../application/use-cases/commands/approval/withdraw-task-approval-vote/withdraw-task-approval-vote.use-case.js';
import type { TaskCollaborationRegistry } from '../../../../application/ports/outbound/task-service/approval/task-collaboration-registry.port.js';
import { TaskApprovalController } from './task-approval.controller.js';

describe('TaskApprovalController', () => {
  const taskKey = 'CAD-482';
  const roundId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
  const userId = '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31';
  const state = {
    taskKey,
    taskVersion: 13,
    taskStatus: 'progress',
    current: {
      roundId,
      requesterUserId: userId,
      requestedAt: '2026-11-08T10:40:00Z',
      status: 'pending',
      reviewers: [],
    },
  };

  function setup() {
    const registry = {
      getTaskApproval: vi.fn().mockResolvedValue({ body: state, version: 13 }),
      requestTaskApproval: vi.fn().mockResolvedValue({ body: state, version: 13 }),
      voteOnTaskApproval: vi.fn().mockResolvedValue({ body: state, version: 13 }),
      withdrawTaskApprovalVote: vi.fn().mockResolvedValue({ version: 13 }),
    };
    const port = registry as unknown as TaskCollaborationRegistry;
    const controller = new TaskApprovalController(
      new GetTaskApproval(port),
      new RequestTaskApproval(port),
      new VoteOnTaskApproval(port),
      new WithdrawTaskApprovalVote(port),
    );
    const setHeader = vi.fn();
    return { controller, registry, setHeader, response: { setHeader } as unknown as Response };
  }

  it('forwards the required version on all writes and returns the ETag', async () => {
    const { controller, registry, response, setHeader } = setup();
    const request = { reviewerUserIds: [userId] };
    await expect(controller.request({ taskKey }, request, '"12"', response)).resolves.toEqual(
      state,
    );
    expect(registry.requestTaskApproval).toHaveBeenCalledWith(taskKey, request, '"12"');
    await controller.vote({ taskKey, roundId }, { decision: 'approved' }, '"12"', response);
    expect(registry.voteOnTaskApproval).toHaveBeenCalledWith(
      taskKey,
      roundId,
      { decision: 'approved' },
      '"12"',
    );
    await controller.withdraw({ taskKey, roundId }, '"12"', response);
    expect(registry.withdrawTaskApprovalVote).toHaveBeenCalledWith(taskKey, roundId, '"12"');
    expect(setHeader).toHaveBeenCalledWith('ETag', '"13"');
  });

  it('rejects a response with the wrong task or ETag', async () => {
    const { controller, registry, response } = setup();
    vi.mocked(registry.getTaskApproval).mockResolvedValueOnce({ body: state, version: 14 });
    await expect(controller.get({ taskKey }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    vi.mocked(registry.getTaskApproval).mockResolvedValueOnce({
      body: { ...state, taskKey: 'CAD-483' },
      version: 13,
    });
    await expect(controller.get({ taskKey }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});

const key = 'CAD-482';
const round = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const reviewer = '019a5f3c-9e1f-7b2a-8c3d-4e5f6a7b8c31';
const routes: readonly TaskRoute[] = [
  {
    method: 'get',
    path: '/v1/tasks/{taskKey}/approvals',
    url: `/v1/tasks/${key}/approvals`,
    call: 'getTaskApproval',
    scope: 'tasks:read',
    status: 200,
    calledWith: [key],
    invalid: { url: '/v1/tasks/invalid/approvals' },
  },
  {
    method: 'post',
    path: '/v1/tasks/{taskKey}/approvals/request',
    url: `/v1/tasks/${key}/approvals/request`,
    call: 'requestTaskApproval',
    scope: 'tasks:write',
    status: 200,
    body: { reviewerUserIds: [reviewer] },
    headers: { 'If-Match': '"12"' },
    calledWith: [key, { reviewerUserIds: [reviewer] }, '"12"'],
    invalid: { body: { reviewerUserIds: [] } },
  },
  {
    method: 'put',
    path: '/v1/tasks/{taskKey}/approvals/{roundId}/votes/me',
    url: `/v1/tasks/${key}/approvals/${round}/votes/me`,
    call: 'voteOnTaskApproval',
    scope: 'tasks:write',
    status: 200,
    body: { decision: 'approved' },
    headers: { 'If-Match': '"13"' },
    calledWith: [key, round, { decision: 'approved' }, '"13"'],
    invalid: { body: { decision: 'changes-requested', reason: '' } },
  },
  {
    method: 'delete',
    path: '/v1/tasks/{taskKey}/approvals/{roundId}/votes/me',
    url: `/v1/tasks/${key}/approvals/${round}/votes/me`,
    call: 'withdrawTaskApprovalVote',
    scope: 'tasks:write',
    status: 204,
    headers: { 'If-Match': '"14"' },
    calledWith: [key, round, '"14"'],
    invalid: { url: `/v1/tasks/${key}/approvals/invalid/votes/me` },
  },
];
const cases: readonly RouteCase[] = routes.flatMap(taskRouteCases);

describe('approval HTTP routes', () => {
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
