import {
  InternalHttpClient,
  InternalTokenSigner,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, OrganizationContext } from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { NOTIFICATION_SERVICE, NotificationServiceClient } from './notification-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};

describe('NotificationServiceClient', () => {
  let signer: InternalTokenSigner;
  let answer: Response;
  let calls: { url: string; init?: RequestInit }[];
  let client: NotificationServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
  });

  beforeEach(() => {
    calls = [];
    answer = new Response(null, { status: 204 });
    client = new NotificationServiceClient(
      new InternalHttpClient({
        service: NOTIFICATION_SERVICE,
        baseUrl: 'http://notification-service.test',
        signer,
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer);
        },
      }),
    );
  });

  it('validates a preference response and its strong ETag', async () => {
    const channel = { inApp: true, email: true, mobile: false };
    const preferences = {
      channels: {
        mention: channel,
        assignment: channel,
        comment: channel,
        statusChange: channel,
        dueDate: channel,
        access: channel,
        billing: channel,
      },
      digest: 'daily',
      doNotDisturb: false,
      version: 1,
    };
    answer = Response.json(preferences, { headers: { ETag: '"1"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getNotificationPreferences()),
    ).resolves.toEqual(preferences);
    answer = Response.json(preferences, { headers: { ETag: '"2"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getNotificationPreferences()),
    ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
  });

  it('does not repeat a checked reminder selection when Notification is unavailable', async () => {
    answer = Response.json(
      { status: 503, code: 'upstream.unavailable' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () =>
        client.listVisibleReminderRecords({ snapshotGeneration: '0', items: [] }),
      ),
    ).rejects.toMatchObject({ problem: { code: 'upstream.unavailable' } });
    expect(calls).toHaveLength(1);
  });

  it('forwards cancellation to the reminder scan transport', async () => {
    const cancellation = new AbortController();
    answer = Response.json({ generation: '0', items: [], nextCursor: null });
    await runWithOrganizationContext(context, () => client.listReminders({}, cancellation.signal));
    const upstreamSignal = calls[0]?.init?.signal;
    expect(upstreamSignal?.aborted).toBe(false);
    cancellation.abort();
    expect(upstreamSignal?.aborted).toBe(true);
  });

  it('forwards the authorized task UUID and conditional header without retrying', async () => {
    await runWithOrganizationContext(context, () =>
      client.deleteReminder(
        '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e12',
        '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23',
        '"3"',
      ),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('authorizedTaskId=019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23');
    expect(new Headers(calls[0]?.init?.headers).get('If-Match')).toBe('"3"');
  });

  it('rejects a returned reminder linked to a different task', async () => {
    const id = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e12';
    const taskId = '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23';
    answer = Response.json(
      {
        id,
        taskId: '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a24',
        remindAt: '2026-11-20T15:00:00Z',
        note: null,
        firedAt: null,
        completedAt: null,
        version: 1,
      },
      { headers: { ETag: '"1"' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.getReminder(id, taskId)),
    ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
  });
});
