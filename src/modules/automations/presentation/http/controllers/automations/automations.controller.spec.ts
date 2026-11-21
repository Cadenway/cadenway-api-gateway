import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { AutomationRegistry } from '../../../../application/ports/outbound/automation-service/rules/automation-registry.port.js';
import { ManageAutomations } from '../../../../application/use-cases/commands/automations/manage-automations/manage-automations.use-case.js';
import { ReadAutomations } from '../../../../application/use-cases/queries/automations/read-automations/read-automations.use-case.js';
import { AutomationsController } from './automations.controller.js';

const ruleId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const rule = {
  ruleId,
  trigger: { type: 'created' as const },
  action: { type: 'priority' as const, priority: 'haute' as const },
  enabled: true,
  version: 2,
  createdAt: '2026-11-20T08:05:00Z',
};

function setup() {
  const registry = {
    authorize: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [rule], nextCursor: null }),
    create: vi.fn().mockResolvedValue(rule),
    update: vi.fn().mockResolvedValue(rule),
    delete: vi.fn().mockResolvedValue(undefined),
    listRunCandidates: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    canReadTask: vi.fn().mockResolvedValue(true),
  } satisfies AutomationRegistry;
  const read = new ReadAutomations(registry);
  const setHeader = vi.fn();
  return {
    controller: new AutomationsController(read, new ManageAutomations(registry)),
    registry,
    read,
    setHeader,
    response: { setHeader } as unknown as Response,
  };
}

describe('AutomationsController', () => {
  it('forwards creation and returns the public location, version and cache policy', async () => {
    const { controller, registry, response, setHeader } = setup();
    const body = { trigger: rule.trigger, action: rule.action };
    await expect(controller.create(body, 'stable-key', response)).resolves.toEqual(rule);
    expect(registry.create).toHaveBeenCalledWith(body, 'stable-key');
    expect(setHeader).toHaveBeenCalledWith('Location', `/v1/automations/${ruleId}`);
    expect(setHeader).toHaveBeenCalledWith('ETag', '"2"');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('forwards the page cursor and version conditions without alteration', async () => {
    const { controller, registry, response, setHeader } = setup();
    await expect(controller.list({ cursor: 'sealed', limit: 12 }, response)).resolves.toEqual({
      items: [rule],
      nextCursor: null,
    });
    await controller.update({ ruleId }, { enabled: false }, '"2"', response);
    await controller.delete({ ruleId }, '"3"');
    expect(registry.list).toHaveBeenCalledWith({ cursor: 'sealed', limit: 12 });
    expect(registry.update).toHaveBeenCalledWith(ruleId, { enabled: false }, '"2"');
    expect(registry.delete).toHaveBeenCalledWith(ruleId, '"3"');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('refuses weak or malformed versions before calling the upstream command', async () => {
    const { controller, registry, response } = setup();
    await expect(
      controller.update({ ruleId }, { enabled: false }, 'W/"2"', response),
    ).rejects.toMatchObject({
      problem: { status: 400, code: 'request.invalid' },
    });
    await expect(controller.delete({ ruleId }, '*')).rejects.toMatchObject({
      problem: { status: 400, code: 'request.invalid' },
    });
    expect(registry.update).not.toHaveBeenCalled();
    expect(registry.delete).not.toHaveBeenCalled();
  });

  it('requires the recent history to satisfy the public limit and rejects extra fields', async () => {
    const { controller, read, response } = setup();
    const runs = vi.spyOn(read, 'execute');
    runs.mockResolvedValue({ items: [], nextCursor: 'private' });
    await expect(controller.runs({}, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    const run = {
      executionId: '019a701b-2b3c-7d4e-8f5a-6b7c8d9e0f12',
      ruleId,
      taskKey: 'CAD-482',
      action: rule.action,
      executedAt: '2026-11-20T08:05:00Z',
    };
    runs.mockResolvedValue({ items: Array(9).fill(run) });
    await expect(controller.runs({}, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('does not leak details when a recipient is ineligible', async () => {
    const { controller, registry, response } = setup();
    vi.mocked(registry.create).mockRejectedValue(
      new ProblemException({
        status: 422,
        code: 'automation.recipient-ineligible',
        details: { private: 'member-data' },
      }),
    );
    await expect(
      controller.create({ trigger: rule.trigger, action: rule.action }, undefined, response),
    ).rejects.toMatchObject({
      problem: { status: 422, code: 'automation.recipient-ineligible' },
    });
    try {
      await controller.create({ trigger: rule.trigger, action: rule.action }, undefined, response);
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemException);
      expect(JSON.stringify((error as ProblemException).problem)).not.toContain('member-data');
    }
  });
});
