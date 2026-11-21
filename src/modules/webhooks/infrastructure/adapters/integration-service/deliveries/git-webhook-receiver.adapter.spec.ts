import { ProblemException } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { createGitWebhookReceiver } from './git-webhook-receiver.adapter.js';

const input = {
  bindingId: '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01',
  delivery: 'd7a11e5e-1197-4af8-815f-b26f5ad28f19',
  event: 'push',
  signature: 'sha256=fixture',
  body: Buffer.from('{}'),
};

describe('Git webhook receiver adapter', () => {
  it('forwards the same delivery and reconstructs documented failures without upstream details', async () => {
    const receiveGitHubWebhook = vi.fn().mockRejectedValue(
      new ProblemException({
        status: 400,
        code: 'webhook.invalid-delivery',
        detail: 'private provider body',
      }),
    );
    const receiver = createGitWebhookReceiver({
      receiveGitHubWebhook,
      receiveGitLabWebhook: vi.fn(),
    });
    const caught: unknown = await receiver.github(input).catch((error: unknown) => error);
    expect(receiveGitHubWebhook).toHaveBeenCalledExactlyOnceWith(input);
    expect(caught).toBeInstanceOf(ProblemException);
    expect(caught).toMatchObject({ problem: { status: 400, code: 'webhook.invalid-delivery' } });
    expect(JSON.stringify(caught)).not.toContain('private provider body');
  });

  it('maps an unexpected error to a fixed upstream failure', async () => {
    const receiver = createGitWebhookReceiver({
      receiveGitHubWebhook: vi.fn().mockRejectedValue(new Error('provider secret')),
      receiveGitLabWebhook: vi.fn(),
    });
    const caught: unknown = await receiver.github(input).catch((error: unknown) => error);
    expect(caught).toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(JSON.stringify(caught)).not.toContain('provider secret');
  });

  it('maps only the provider authentication refusal to the public 401', async () => {
    const receiveGitHubWebhook = vi.fn().mockRejectedValue(
      new ProblemException({
        status: 403,
        code: 'webhook.authentication-failed',
        detail: 'secret',
      }),
    );
    const receiver = createGitWebhookReceiver({
      receiveGitHubWebhook,
      receiveGitLabWebhook: vi.fn(),
    });
    await expect(receiver.github(input)).rejects.toMatchObject({
      problem: { status: 401, code: 'webhook.authentication-failed' },
    });
    receiveGitHubWebhook.mockRejectedValue(
      new ProblemException({ status: 403, code: 'auth.issuer-not-allowed' }),
    );
    await expect(receiver.github(input)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});
