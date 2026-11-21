import { ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
import { ReceiveGitHubWebhookQueryParams } from '@cadenway/contracts/validators/public/webhooks';
import type { Request } from 'express';
import requestHttp from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';

import { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import { createFakeIdentity } from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { CountWebhookRequest } from '../../../../../rate-limit/public/addresses/count-webhook-request.js';
import type { GitHubWebhookDelivery } from '../../../../application/models/deliveries/git-webhook-delivery.model.js';
import { ReceiveGitWebhook } from '../../../../application/use-cases/commands/deliveries/receive-git-webhook/receive-git-webhook.use-case.js';
import { GitWebhooksController } from './git-webhooks.controller.js';

const bindingId = '019a700b-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const delivery = 'd7a11e5e-1197-4af8-815f-b26f5ad28f19';
const githubSignature = `sha256=${'a'.repeat(64)}`;
const payload = Buffer.from('\n{ "action": "opened", "title": "écran" }\n');
const gitlabMetadata = {
  'webhook-id': [delivery],
  'x-gitlab-event': ['Merge Request Hook'],
  'webhook-signature': ['v1,c2lnbmF0dXJl v1,c2Vjb25k'],
};
const gitlabHeaders = { ...gitlabMetadata, 'webhook-timestamp': ['0000001234'] };

function request(headersDistinct: Request['headersDistinct'], body: unknown = payload): Request {
  return {
    headersDistinct,
    body,
    is: (type: string) => (type === 'application/json' ? type : false),
  } as unknown as Request;
}

describe('public Git webhook delivery', () => {
  it('passes the original GitHub buffer and headers unchanged', async () => {
    const github = vi
      .fn<(input: GitHubWebhookDelivery) => Promise<void>>()
      .mockResolvedValue(undefined);
    const gitlab = vi.fn();
    const controller = new GitWebhooksController(new ReceiveGitWebhook({ github, gitlab }));
    await controller.github(
      request({
        'x-github-delivery': [delivery],
        'x-github-event': ['pull_request'],
        'x-hub-signature-256': [githubSignature],
      }),
      { bindingId },
    );
    expect(github).toHaveBeenCalledExactlyOnceWith({
      bindingId,
      delivery,
      event: 'pull_request',
      signature: githubSignature,
      body: payload,
    });
    expect(github.mock.calls[0]?.[0].body).toBe(payload);
    expect(gitlab).not.toHaveBeenCalled();
  });

  it('preserves GitLab timestamp and the signature list', async () => {
    const github = vi.fn();
    const gitlab = vi.fn().mockResolvedValue(undefined);
    const controller = new GitWebhooksController(new ReceiveGitWebhook({ github, gitlab }));
    await controller.gitlab(request(gitlabHeaders), { bindingId });
    expect(gitlab).toHaveBeenCalledExactlyOnceWith({
      bindingId,
      delivery,
      event: 'Merge Request Hook',
      timestamp: '0000001234',
      signature: 'v1,c2lnbmF0dXJl v1,c2Vjb25k',
      body: payload,
    });
    expect(github).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'missing', headers: {} },
    { name: 'malformed', headers: { 'webhook-timestamp': ['not-a-timestamp'] } },
    { name: 'repeated', headers: { 'webhook-timestamp': ['0000001234', '0000001234'] } },
  ])(
    'returns a generic authentication refusal for a $name GitLab timestamp',
    async ({ headers }) => {
      const gitlab = vi.fn();
      const controller = new GitWebhooksController(
        new ReceiveGitWebhook({ github: vi.fn(), gitlab }),
      );
      await expect(
        controller.gitlab(request({ ...gitlabMetadata, ...headers }), { bindingId }),
      ).rejects.toMatchObject({ problem: { status: 401, code: 'webhook.authentication-failed' } });
      expect(gitlab).not.toHaveBeenCalled();
    },
  );

  it.each(['webhook-id', 'x-gitlab-event'] as const)(
    'keeps a repeated GitLab %s header a bad request',
    async (header) => {
      const gitlab = vi.fn();
      const controller = new GitWebhooksController(
        new ReceiveGitWebhook({ github: vi.fn(), gitlab }),
      );
      const value = gitlabHeaders[header];
      await expect(
        controller.gitlab(request({ ...gitlabHeaders, [header]: [...value, ...value] }), {
          bindingId,
        }),
      ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
      expect(gitlab).not.toHaveBeenCalled();
    },
  );

  it('rejects repeated metadata, absent signatures and decoded JSON before relaying', async () => {
    const github = vi.fn();
    const controller = new GitWebhooksController(
      new ReceiveGitWebhook({ github, gitlab: vi.fn() }),
    );
    const headers = {
      'x-github-delivery': [delivery],
      'x-github-event': ['pull_request'],
      'x-hub-signature-256': [githubSignature],
    };
    await expect(
      controller.github(request({ ...headers, 'x-github-event': ['push', 'pull_request'] }), {
        bindingId,
      }),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
    await expect(
      controller.github(request({ ...headers, 'x-hub-signature-256': [] }), { bindingId }),
    ).rejects.toMatchObject({ problem: { status: 401, code: 'webhook.authentication-failed' } });
    await expect(
      controller.github(request(headers, { action: 'opened' }), { bindingId }),
    ).rejects.toMatchObject({ problem: { status: 400, code: 'request.invalid' } });
    expect(github).not.toHaveBeenCalled();
  });

  it('rejects unknown, repeated or non-v7 binding parameters', () => {
    const pipe = new ZodValidationPipe(ReceiveGitHubWebhookQueryParams.strict());
    expect(pipe.transform({ bindingId }, { type: 'query' })).toEqual({ bindingId });
    for (const query of [
      { bindingId, extra: 'value' },
      { bindingId: [bindingId, bindingId] },
      { bindingId: delivery },
    ]) {
      expect(() => pipe.transform(query, { type: 'query' })).toThrow(ProblemException);
    }
  });
});

describe('public Git webhook HTTP pipeline', () => {
  let route: RouteApplication;
  let receive: MockInstance<IntegrationServiceClient['receiveGitHubWebhook']>;
  let count: MockInstance<CountWebhookRequest['execute']>;

  beforeAll(async () => {
    route = await createRouteApplication(createFakeIdentity());
    receive = vi.spyOn(route.app.get(IntegrationServiceClient), 'receiveGitHubWebhook');
    count = vi.spyOn(route.app.get(CountWebhookRequest), 'execute');
    receive.mockResolvedValue(undefined);
    count.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  afterAll(async () => {
    await route.app.close();
  });

  it('ignores unrelated credentials and retains the exact bytes on a 204', async () => {
    const response = await requestHttp(route.server)
      .post(`/v1/webhooks/github?bindingId=${bindingId}`)
      .set('Authorization', 'Bearer an-irrelevant-token')
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Delivery', delivery)
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', githubSignature)
      .send(payload.toString('utf8'));
    expect(response.status).toBe(204);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(receive).toHaveBeenCalledWith(expect.objectContaining({ body: payload }));
  });

  it('returns private, no-store for validation and rate-limit errors', async () => {
    const invalid = await requestHttp(route.server)
      .post('/v1/webhooks/github?unexpected=value')
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(invalid.status).toBe(400);
    expect(invalid.headers['cache-control']).toBe('private, no-store');
    count.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });
    const limited = await requestHttp(route.server)
      .post(`/v1/webhooks/github?bindingId=${bindingId}`)
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(limited.status).toBe(429);
    expect(limited.headers['cache-control']).toBe('private, no-store');
    expect(limited.headers['retry-after']).toBe('12');
    expect(limited.headers.ratelimit).toBeDefined();
    expect(limited.headers['ratelimit-policy']).toBeDefined();
  });

  it('returns a sanitized public 401 for an Integration provider refusal', async () => {
    receive.mockRejectedValueOnce(
      new ProblemException({
        status: 403,
        code: 'webhook.authentication-failed',
        detail: 'private-provider-credential',
      }),
    );
    const response = await requestHttp(route.server)
      .post(`/v1/webhooks/github?bindingId=${bindingId}`)
      .set('Content-Type', 'application/json')
      .set('X-GitHub-Delivery', delivery)
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', githubSignature)
      .send('{}');
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({ code: 'webhook.authentication-failed' });
    expect(JSON.stringify(response.body)).not.toContain('private-provider-credential');
    expect(route.logLines.join('\n')).not.toContain('private-provider-credential');
  });
});
