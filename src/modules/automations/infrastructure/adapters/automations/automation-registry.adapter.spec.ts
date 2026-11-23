import {
  ProblemException,
  runWithOrganizationContext,
  type OrganizationContext,
} from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import type { AutomationServiceClient } from '../../../../../clients/automation-service.client.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import { createAutomationRegistry } from './automation-registry.adapter.js';

const organizationId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const ownerId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e02';
const recipient = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e03';
const rule = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e04';
const context: OrganizationContext = {
  organizationId,
  actor: { type: 'user', id: ownerId },
  role: 'owner',
  scopes: ['tasks:write', 'automation:recipient:forged'],
};
const create = {
  trigger: { type: 'created' },
  action: { type: 'assign', userId: recipient.toUpperCase() },
} as const;

function fixture(role: 'owner' | 'admin' | 'member' = 'owner', id = organizationId) {
  const getOrganization = vi.fn<OrganizationServiceClient['getOrganization']>().mockResolvedValue({
    id,
    name: 'Atelier Nord',
    slug: 'atelier-nord',
    description: null,
    website: null,
    defaultLanguage: 'fr',
    plan: 'free',
    memberCount: 1,
    role,
    createdAt: '2026-11-20T08:00:00Z',
    version: 1,
  });
  const checkAutomationRecipient = vi
    .fn<OrganizationServiceClient['checkAutomationRecipient']>()
    .mockResolvedValue(true);
  const createRule = vi.fn<AutomationServiceClient['createRule']>().mockResolvedValue({
    ...create,
    ruleId: rule,
    enabled: true,
    version: 1,
    createdAt: '2026-11-20T08:00:00Z',
  });
  const listRules = vi.fn<AutomationServiceClient['listRules']>();
  const updateRule = vi.fn<AutomationServiceClient['updateRule']>();
  const deleteRule = vi.fn<AutomationServiceClient['deleteRule']>();
  const listRunCandidates = vi.fn<AutomationServiceClient['listRunCandidates']>();
  const getTask = vi.fn<TaskServiceClient['getTask']>();
  const registry = createAutomationRegistry(
    { getOrganization, checkAutomationRecipient },
    { createRule, listRules, updateRule, deleteRule, listRunCandidates },
    { getTask },
  );
  return {
    registry,
    getOrganization,
    checkAutomationRecipient,
    createRule,
    listRules,
    updateRule,
    deleteRule,
    getTask,
  };
}

describe('Automation registry authority', () => {
  it('checks the live recipient on every attempt and signs exactly the matching canonical proof', async () => {
    const { registry, checkAutomationRecipient, createRule } = fixture();
    await runWithOrganizationContext(context, () => registry.create(create, 'stable-key'));
    expect(checkAutomationRecipient).toHaveBeenCalledExactlyOnceWith(recipient);
    expect(createRule).toHaveBeenCalledExactlyOnceWith(create, {
      claims: {
        actor: context.actor,
        organizationId,
        scopes: [`automation:recipient:${recipient}`],
      },
      headers: { 'Idempotency-Key': 'stable-key' },
    });

    checkAutomationRecipient.mockResolvedValue(false);
    await expect(
      runWithOrganizationContext(context, () => registry.create(create, 'stable-key')),
    ).rejects.toMatchObject({
      problem: { status: 422, code: 'automation.recipient-ineligible' },
    });
    expect(checkAutomationRecipient).toHaveBeenCalledTimes(2);
    expect(createRule).toHaveBeenCalledOnce();
  });

  it('rejects a non-v7 recipient before either service is called', async () => {
    const { registry, checkAutomationRecipient, createRule } = fixture();
    await expect(
      runWithOrganizationContext(context, () =>
        registry.create(
          { ...create, action: { type: 'assign', userId: 'e4342a98-7528-4b0e-9826-63e07fce70ab' } },
          'stable-key',
        ),
      ),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
    expect(checkAutomationRecipient).not.toHaveBeenCalled();
    expect(createRule).not.toHaveBeenCalled();
  });

  it('uses the current Organization role and passes strong write conditions', async () => {
    const { registry, getOrganization, createRule, updateRule, deleteRule } = fixture('admin');
    const priority = {
      trigger: { type: 'created' },
      action: { type: 'priority', priority: 'haute' },
    } as const;
    await runWithOrganizationContext(context, async () => {
      await registry.create(priority, undefined);
      await registry.update(rule, { enabled: false }, '"1"');
      await registry.delete(rule, '"2"');
    });
    expect(getOrganization).toHaveBeenCalledTimes(3);
    expect(createRule).toHaveBeenCalledWith(priority, {
      claims: { actor: context.actor, organizationId, scopes: [] },
    });
    expect(updateRule).toHaveBeenCalledWith(rule, { enabled: false }, '"1"');
    expect(deleteRule).toHaveBeenCalledWith(rule, '"2"');
  });

  it('rejects a stale privileged session and a response from a different organization', async () => {
    const stale = fixture('member');
    await expect(
      runWithOrganizationContext(context, () => stale.registry.list({ limit: 10 })),
    ).rejects.toMatchObject({
      problem: { status: 403, code: 'organization.role-forbidden' },
    });
    const other = fixture('admin', rule);
    await expect(
      runWithOrganizationContext(context, () => other.registry.list({ limit: 10 })),
    ).rejects.toMatchObject({
      problem: {
        status: 503,
        code: 'upstream.failed',
        details: { service: 'organization-service' },
      },
    });
    expect(stale.listRules).not.toHaveBeenCalled();
    expect(other.listRules).not.toHaveBeenCalled();
  });

  it('only treats the canonical hidden or trashed responses as invisible', async () => {
    const { registry, getTask } = fixture();
    getTask
      .mockRejectedValueOnce(new ProblemException({ status: 404, code: 'task.trashed' }))
      .mockRejectedValueOnce(new ProblemException({ status: 404, code: 'task.not-found' }))
      .mockRejectedValueOnce(
        new ProblemException({
          status: 403,
          code: 'auth.issuer-not-allowed',
          details: { service: 'task-service' },
        }),
      );
    await expect(registry.visibleTaskKeys(['CAD-482', 'CAD-483'])).resolves.toEqual(new Set());
    await expect(registry.visibleTaskKeys(['CAD-482'])).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.unauthorized', details: { service: 'task-service' } },
    });
  });
});
