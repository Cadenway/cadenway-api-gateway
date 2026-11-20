import 'reflect-metadata';

import {
  GetNotificationPreferencesInternalResponse,
  ListInboxNotificationsInternalResponse,
  ListInboxUnreadSubjectsInternalResponse,
  ListRemindersInternalResponse,
  ListVisibleReminderRecordsInternalResponse,
  MarkInboxNotificationsReadInternalResponse,
  SetTaskReminderInternalResponse,
} from '@cadenway/contracts/validators/internal/notification-service';
import { ListInboxNotificationsResponse } from '@cadenway/contracts/validators/public/inbox';
import { InternalHttpClient, InternalTokenSigner, ProblemException } from '@cadenway/nest-common';
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

import {
  NOTIFICATION_SERVICE,
  NotificationServiceClient,
} from '../src/clients/notification-service.client.js';
import {
  CAMILLE_ORGANIZATION_SESSION,
  CAMILLE_ORGANIZATION_TOKEN,
  CAMILLE_TOKEN,
  createFakeIdentity,
} from './support/fake-identity.js';
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
const firstNotification = {
  id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e11',
  kind: 'mention',
  subject: null,
  actorUserId: null,
  createdAt: '2026-11-09T08:48:00Z',
  readAt: null,
  archivedAt: null,
  version: 1,
};

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

  it.each(['read', 'archive'] as const)(
    'accepts a bodyless Inbox %s POST from the app',
    async (action) => {
      const candidate = vi
        .spyOn(notification, 'getInboxNotificationCandidate')
        .mockResolvedValue(firstNotification);
      const operation =
        action === 'read' ? 'markInboxNotificationRead' : 'archiveInboxNotification';
      const mutate = vi.spyOn(notification, operation).mockResolvedValue(firstNotification);
      const response = await runRouteCase(gateway, identity, {
        name: `bodyless Inbox ${action}`,
        method: 'post',
        path: `/v1/inbox/notifications/{notificationId}/${action}`,
        url: `/v1/inbox/notifications/${firstNotification.id}/${action}`,
        status: 200,
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(candidate).toHaveBeenCalledWith(firstNotification.id);
      expect(mutate).toHaveBeenCalledWith(firstNotification.id, { subject: null }, undefined);
    },
  );

  it('accepts a bodyless reminder completion POST from the app', async () => {
    vi.spyOn(notification, 'getReminderCandidate').mockResolvedValue({ id: reminderId, taskId });
    const complete = vi
      .spyOn(notification, 'completeReminder')
      .mockResolvedValue({ ...reminder, completedAt: reminder.remindAt });
    const response = await runRouteCase(gateway, identity, {
      name: 'bodyless reminder completion',
      method: 'post',
      path: '/v1/reminders/{reminderId}/complete',
      url: `/v1/reminders/${reminderId}/complete`,
      status: 200,
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(complete).toHaveBeenCalledWith(reminderId, taskId, undefined);
  });

  it('returns a private upstream Problem when Notification supplies a different reminder candidate', async () => {
    const unexpectedId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e66';
    const upstream = new NotificationServiceClient(
      new InternalHttpClient({
        service: NOTIFICATION_SERVICE,
        baseUrl: 'http://notification-service.test',
        signer: gateway.app.get(InternalTokenSigner),
        fetch: () => Promise.resolve(Response.json({ id: unexpectedId, taskId })),
      }),
    );
    vi.spyOn(notification, 'getReminderCandidate').mockImplementation((id) =>
      upstream.getReminderCandidate(id),
    );
    const response = await runRouteCase(gateway, identity, {
      name: 'different reminder candidate',
      method: 'get',
      path: '/v1/reminders/{reminderId}',
      url: `/v1/reminders/${reminderId.toUpperCase()}`,
      status: 503,
      code: 'upstream.failed',
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ details: { service: NOTIFICATION_SERVICE } });
    expect(response.text).not.toContain(unexpectedId);
    expect(response.text).not.toContain(taskId);
    expect(response.text).not.toContain('mismatched reminder candidate');
    expect(gateway.task.resolveNotificationSubjects).not.toHaveBeenCalled();
  });

  it('still refuses an untrusted Origin or a non-JSON body before a bodyless write', async () => {
    const path = '/v1/inbox/notifications/read-all';
    const untrusted = await runRouteCase(gateway, identity, {
      name: 'empty POST from an untrusted origin',
      method: 'post',
      path,
      url: path,
      origin: 'https://other.example',
      status: 403,
      code: 'auth.csrf-rejected',
    });
    const text = await request(gateway.server)
      .post(path)
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'text/plain')
      .send('not JSON');
    expectPublicResponse('post', path, text);
    expect(text.status).toBe(403);
    expect(text.body).toMatchObject({ code: 'auth.csrf-rejected' });
    expect(text.headers['cache-control']).toBe('no-store');
    expect(untrusted.headers['cache-control']).toBe('no-store');
    expect(markRead).not.toHaveBeenCalled();
  });

  it('resumes across a hidden Inbox candidate without exposing its scan position', async () => {
    const path = '/v1/inbox/notifications';
    const hidden = {
      ...firstNotification,
      id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e22',
      createdAt: '2026-11-09T08:47:00Z',
      subject: { kind: 'task-id', taskId },
    };
    const last = { ...firstNotification, id: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e33' };
    const privateCursor = Buffer.from(
      JSON.stringify({ createdAt: hidden.createdAt, id: hidden.id }),
    ).toString('base64url');
    const listCandidates = vi
      .spyOn(notification, 'listInboxNotifications')
      .mockResolvedValueOnce(
        ListInboxNotificationsInternalResponse.parse({
          items: [
            { record: firstNotification, cursorAfter: 'after-visible' },
            { record: hidden, cursorAfter: privateCursor },
            { record: last, cursorAfter: 'after-lookahead' },
          ],
          nextCursor: null,
        }),
      )
      .mockResolvedValueOnce(
        ListInboxNotificationsInternalResponse.parse({
          items: [{ record: last, cursorAfter: 'after-lookahead' }],
          nextCursor: null,
        }),
      );
    gateway.task.resolveNotificationSubjects.mockResolvedValue({ results: [{ visible: false }] });
    gateway.logLines.length = 0;
    const page = await runRouteCase(gateway, identity, {
      name: 'list only visible records',
      method: 'get',
      path,
      url: `${path}?limit=1`,
      status: 200,
    });
    expect(page.body).toMatchObject({ items: [{ id: firstNotification.id }] });
    expect(page.text).not.toContain(hidden.id);
    const { nextCursor: cursor } = ListInboxNotificationsResponse.parse(page.body);
    if (cursor === null) throw new Error('The first page should expose a continuation.');
    expect(cursor).not.toBe(privateCursor);
    expect(Buffer.from(cursor, 'base64url').includes(privateCursor)).toBe(false);

    for (const mismatch of [
      { cursor: privateCursor },
      { cursor: `${cursor}=` },
      { cursor, state: 'unread' },
      { cursor, organizationId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e44' },
      { cursor, userId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e55' },
    ]) {
      const { organizationId, userId, state } = mismatch;
      if (organizationId !== undefined || userId !== undefined) {
        identity.introspect.mockResolvedValueOnce({
          ...CAMILLE_ORGANIZATION_SESSION,
          ...(organizationId === undefined ? {} : { organizationId }),
          ...(userId === undefined ? {} : { userId }),
        });
      }
      const query = new URLSearchParams({ cursor: mismatch.cursor, ...(state ? { state } : {}) });
      const refusal = await runRouteCase(gateway, identity, {
        name: 'reject an invalid continuation before the Notification scan',
        method: 'get',
        path,
        url: `${path}?${query.toString()}`,
        status: 400,
        code: 'request.invalid',
      });
      expect(refusal.body).toMatchObject({
        details: { issues: [{ in: 'query', path: 'cursor' }] },
      });
      expect(refusal.headers['cache-control']).toBe('no-store');
    }
    expect(listCandidates).toHaveBeenCalledTimes(1);
    expect(unreadSubjects).toHaveBeenCalledTimes(1);

    const resumed = await runRouteCase(gateway, identity, {
      name: 'resume with explicit default state and a different page size',
      method: 'get',
      path,
      url: `${path}?cursor=${cursor}&state=active&limit=2`,
      status: 200,
    });
    expect(resumed.body).toMatchObject({ items: [{ id: last.id }], nextCursor: null });
    expect(listCandidates).toHaveBeenLastCalledWith(
      { cursor: privateCursor, state: 'active', limit: 100 },
      expect.any(AbortSignal),
    );
    const logs = gateway.logLines.join('\n');
    expect(logs).not.toContain(cursor);
    expect(logs).not.toContain(privateCursor);
    expect(logs).not.toContain(hidden.id);
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
      headers: { 'If-None-Match': '*' },
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
