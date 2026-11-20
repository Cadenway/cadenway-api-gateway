import 'reflect-metadata';

import {
  GetNotificationPreferencesInternalResponse,
  ListInboxUnreadSubjectsInternalResponse,
  ListRemindersInternalResponse,
  ListVisibleReminderRecordsInternalResponse,
  MarkInboxNotificationsReadInternalResponse,
  SetTaskReminderInternalResponse,
} from '@cadenway/contracts/validators/internal/notification-service';
import { ProblemException } from '@cadenway/nest-common';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import { NotificationServiceClient } from '../src/clients/notification-service.client.js';
import { CAMILLE_TOKEN, createFakeIdentity } from './support/fake-identity.js';
import { expectPublicResponse, responseExample } from './support/public-contract.js';
import { runRouteCase } from './support/route-cases.js';
import { createRouteApplication, type RouteApplication } from './support/route-application.js';
import { ALLOWED_ORIGIN } from './support/test-environment.js';

const identity = createFakeIdentity();
const taskId = '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23';
const reminderId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e12';
const task = { taskId, taskKey: 'CAD-482', taskName: 'Current task' };
const reminder = SetTaskReminderInternalResponse.parse({
  id: reminderId,
  taskId,
  remindAt: '2026-12-08T14:00:00Z',
  note: null,
  firedAt: null,
  completedAt: null,
  version: 3,
});
const preferences = GetNotificationPreferencesInternalResponse.parse(
  responseExample('get', '/v1/me/notification-preferences', 200),
);

describe('notification routes with gateway middleware', () => {
  let gateway: RouteApplication;
  let notification: NotificationServiceClient;
  let updatePreferences: MockInstance<NotificationServiceClient['updateNotificationPreferences']>;
  let unreadSubjects: MockInstance<NotificationServiceClient['listInboxUnreadSubjects']>;
  let markRead: MockInstance<NotificationServiceClient['markInboxNotificationsRead']>;
  let selectedReminders: MockInstance<NotificationServiceClient['listVisibleReminderRecords']>;
  let setReminder: MockInstance<NotificationServiceClient['setTaskReminder']>;

  beforeAll(async () => {
    gateway = await createRouteApplication(identity);
    notification = gateway.app.get(NotificationServiceClient);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    gateway.counter.consume.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    gateway.task.resolveNotificationSubjects.mockReset().mockResolvedValue({
      results: [{ visible: true, display: task }],
    });
    vi.spyOn(notification, 'getNotificationPreferences').mockResolvedValue(preferences);
    updatePreferences = vi
      .spyOn(notification, 'updateNotificationPreferences')
      .mockResolvedValue(preferences);
    unreadSubjects = vi.spyOn(notification, 'listInboxUnreadSubjects').mockResolvedValue(
      ListInboxUnreadSubjectsInternalResponse.parse({
        generation: '7',
        items: [{ subject: { kind: 'task-id', taskId }, count: 2 }],
        nextCursor: null,
      }),
    );
    markRead = vi
      .spyOn(notification, 'markInboxNotificationsRead')
      .mockResolvedValue(
        MarkInboxNotificationsReadInternalResponse.parse({ markedRead: 2, unreadCount: 0 }),
      );
    vi.spyOn(notification, 'listReminders').mockResolvedValue(
      ListRemindersInternalResponse.parse({
        generation: '7',
        items: [],
        nextCursor: null,
      }),
    );
    selectedReminders = vi
      .spyOn(notification, 'listVisibleReminderRecords')
      .mockResolvedValue(ListVisibleReminderRecordsInternalResponse.parse({ items: [] }));
    setReminder = vi
      .spyOn(notification, 'setTaskReminder')
      .mockResolvedValue({ reminder, created: true });
  });

  afterAll(async () => gateway.app.close());

  it('reads and updates account preferences without an organization and avoids caching', async () => {
    const read = await runRouteCase(gateway, identity, {
      name: 'account preferences without an organization',
      method: 'get',
      path: '/v1/me/notification-preferences',
      url: '/v1/me/notification-preferences',
      credential: 'session-without-organization',
      headers: { 'If-None-Match': `"${String(preferences.version)}"` },
      status: 200,
    });
    expect(read.headers['cache-control']).toContain('no-store');
    expect(read.headers.etag).toBe(`"${String(preferences.version)}"`);

    const updated = await runRouteCase(gateway, identity, {
      name: 'update account preferences without an organization',
      method: 'patch',
      path: '/v1/me/notification-preferences',
      url: '/v1/me/notification-preferences',
      credential: 'session-without-organization',
      headers: { 'If-Match': `"${String(preferences.version)}"` },
      body: { digest: 'weekly' },
      status: 200,
    });
    expect(updated.headers['cache-control']).toContain('no-store');
    expect(updatePreferences).toHaveBeenCalledWith(
      { digest: 'weekly' },
      `"${String(preferences.version)}"`,
    );
  });

  it('checks CSRF before forwarding a preference write', async () => {
    const response = await runRouteCase(gateway, identity, {
      name: 'untrusted origin',
      method: 'patch',
      path: '/v1/me/notification-preferences',
      url: '/v1/me/notification-preferences',
      credential: 'session-without-organization',
      origin: 'https://other.example',
      body: { digest: 'weekly' },
      status: 403,
      code: 'auth.csrf-rejected',
    });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('keeps malformed private request errors out of caches', async () => {
    const response = await request(gateway.server)
      .patch('/v1/me/notification-preferences')
      .set('Cookie', `__Host-cw_session=${CAMILLE_TOKEN}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"digest":');
    expectPublicResponse('patch', '/v1/me/notification-preferences', response);
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it.each([
    ['/v1/me/notification-preferences', '/v1/me/notification-preferences'],
    ['/v1/inbox/unread-count', '/v1/inbox/unread-count'],
    ['/v1/reminders', '/v1/reminders'],
  ])('refuses API tokens on session-only GET %s', async (path, url) => {
    await runRouteCase(gateway, identity, {
      name: 'personal token on session-only route',
      method: 'get',
      path,
      url,
      credential: 'tasks-token',
      status: 403,
      code: 'auth.api-token-not-accepted',
    });
  });

  it.each(['/v1/inbox/unread-count', '/v1/reminders'])(
    'requires an organization on %s',
    async (path) => {
      await runRouteCase(gateway, identity, {
        name: 'no selected organization',
        method: 'get',
        path,
        url: path,
        credential: 'session-without-organization',
        status: 403,
        code: 'organization.not-selected',
      });
    },
  );

  it('checks Task visibility for the unread badge and read-all write', async () => {
    const read = await runRouteCase(gateway, identity, {
      name: 'authorized unread count',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 200,
    });
    expect(read.body).toEqual({ unreadCount: 2 });
    expect(read.headers['cache-control']).toContain('no-store');
    expect(gateway.task.resolveNotificationSubjects).toHaveBeenCalled();

    await runRouteCase(gateway, identity, {
      name: 'mark authorized notifications read',
      method: 'post',
      path: '/v1/inbox/notifications/read-all',
      url: '/v1/inbox/notifications/read-all',
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
    expect(markRead).toHaveBeenCalledWith(
      {
        snapshotGeneration: '7',
        creationCutoff: '7',
        authorizedSubjects: [{ kind: 'task-id', taskId }],
      },
      expect.any(AbortSignal),
    );
  });

  it('does not disclose unread weight when Task denies the current subject', async () => {
    gateway.task.resolveNotificationSubjects.mockResolvedValue({ results: [{ visible: false }] });
    const response = await runRouteCase(gateway, identity, {
      name: 'hidden task is excluded',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 200,
    });
    expect(response.body).toEqual({ unreadCount: 0 });
  });

  it('reads an empty generation-bound reminder page and creates against current Task access', async () => {
    const page = await runRouteCase(gateway, identity, {
      name: 'empty reminder page',
      method: 'get',
      path: '/v1/reminders',
      url: '/v1/reminders',
      status: 200,
    });
    expect(page.body).toEqual({ items: [], nextCursor: null, pendingCount: 0 });
    expect(page.headers['cache-control']).toContain('no-store');
    expect(selectedReminders).toHaveBeenCalled();

    const created = await runRouteCase(gateway, identity, {
      name: 'create a reminder on a visible task',
      method: 'put',
      path: '/v1/tasks/{taskKey}/reminder',
      url: '/v1/tasks/CAD-482/reminder',
      body: { remindAt: reminder.remindAt, note: null },
      status: 201,
    });
    expect(created.headers.location).toBe(`/v1/reminders/${reminderId}`);
    expect(created.headers['cache-control']).toContain('no-store');
    expect(setReminder).toHaveBeenCalledWith(
      taskId,
      { remindAt: reminder.remindAt, note: null },
      undefined,
    );
  });

  it('returns a public 503 if the Notification scan fails', async () => {
    vi.spyOn(notification, 'listInboxUnreadSubjects').mockRejectedValue(
      new ProblemException({
        status: 503,
        code: 'upstream.failed',
        details: { service: 'notification-service' },
      }),
    );
    const response = await runRouteCase(gateway, identity, {
      name: 'unavailable notification dependency',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 503,
    });
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('returns a public 503 if Task cannot authorize an unread subject', async () => {
    gateway.task.resolveNotificationSubjects.mockRejectedValue(
      new ProblemException({
        status: 503,
        code: 'upstream.failed',
        details: { service: 'task-service' },
      }),
    );
    await runRouteCase(gateway, identity, {
      name: 'unavailable Task dependency',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 503,
    });
  });

  it('aborts a slow Task authorization at the shared request deadline', async () => {
    let aborted = false;
    gateway.task.resolveNotificationSubjects.mockImplementation(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
        }),
    );
    const response = await runRouteCase(gateway, identity, {
      name: 'Task authorization exceeds the deadline',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 503,
      code: 'upstream.deadline-exceeded',
    });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(aborted).toBe(true);
  }, 20_000);

  it('returns the rate-limit response before accessing Notification', async () => {
    gateway.counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await runRouteCase(gateway, identity, {
      name: 'session rate limited',
      method: 'get',
      path: '/v1/inbox/unread-count',
      url: '/v1/inbox/unread-count',
      status: 429,
      code: 'rate-limit.exceeded',
    });
    expect(response.headers['retry-after']).toBe('12');
    expect(response.headers['cache-control']).toContain('no-store');
    expect(unreadSubjects).not.toHaveBeenCalled();
  });
});
