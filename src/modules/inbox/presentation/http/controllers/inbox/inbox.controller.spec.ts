import 'reflect-metadata';

import { ProblemException } from '@cadenway/nest-common';
import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { InboxNotFound } from '../../../../application/models/inbox/inbox-not-found.model.js';
import { ChangeInboxNotification } from '../../../../application/use-cases/commands/inbox/change-inbox-notification/change-inbox-notification.use-case.js';
import { MarkInboxNotificationsRead } from '../../../../application/use-cases/commands/inbox/mark-inbox-notifications-read/mark-inbox-notifications-read.use-case.js';
import { GetInboxUnreadCount } from '../../../../application/use-cases/queries/inbox/get-inbox-unread-count/get-inbox-unread-count.use-case.js';
import { ListInboxNotifications } from '../../../../application/use-cases/queries/inbox/list-inbox-notifications/list-inbox-notifications.use-case.js';
import { InboxController } from './inbox.controller.js';

/** Serializes typed problems for the isolated controller HTTP tests. */
@Catch(ProblemException)
class TestProblemFilter implements ExceptionFilter {
  // #region Methods
  /** Sends the problem status and body. */
  public catch(error: ProblemException, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(error.problem.status).json(error.problem);
  }
  // #endregion
}

describe('InboxController', () => {
  const list = vi.fn();
  const unread = vi.fn();
  const readAll = vi.fn();
  const change = vi.fn();
  const id = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e11';
  const record = {
    id,
    kind: 'mention',
    actor: null,
    task: null,
    excerpt: null,
    status: null,
    createdAt: '2026-11-08T08:48:00Z',
    readAt: null,
    archivedAt: null,
    version: 2,
  };
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [
        { provide: ListInboxNotifications, useValue: { execute: list } },
        { provide: GetInboxUnreadCount, useValue: { execute: unread } },
        { provide: MarkInboxNotificationsRead, useValue: { execute: readAll } },
        { provide: ChangeInboxNotification, useValue: { execute: change } },
      ],
    })
      .overrideGuard(CredentialGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new TestProblemFilter());
    await app.init();
    server = app.getHttpServer() as App;
  });
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ items: [record], nextCursor: null, unreadCount: 1 });
    unread.mockReset().mockResolvedValue({ unreadCount: 1 });
    readAll.mockReset().mockResolvedValue({ markedRead: 1, unreadCount: 0 });
    change.mockReset().mockResolvedValue(record);
  });
  afterAll(async () => app.close());

  it('passes filters and suppresses conditional 304 responses', async () => {
    const result = await request(server)
      .get('/v1/inbox/notifications?state=unread&limit=5')
      .set('If-None-Match', '*');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ items: [record] });
    expect(list).toHaveBeenCalledWith({ state: 'unread', limit: 5, cursor: null });
  });

  it('returns a version for an exact checked notification mutation', async () => {
    const result = await request(server)
      .post(`/v1/inbox/notifications/${id}/read`)
      .set('If-Match', '"1", "2"');
    expect(result.status).toBe(200);
    expect(result.headers.etag).toBe('"2"');
    expect(change).toHaveBeenCalledWith(id, 'read', '"1", "2"');
  });

  it('conceals a hidden subject and preserves version mismatch ETags', async () => {
    change.mockRejectedValueOnce(new InboxNotFound());
    expect((await request(server).post(`/v1/inbox/notifications/${id}/archive`)).status).toBe(404);
    change.mockRejectedValueOnce(
      new ProblemException({
        status: 412,
        code: 'request.version-mismatch',
        details: { service: 'notification-service', version: 2 },
      }),
    );
    const mismatch = await request(server)
      .post(`/v1/inbox/notifications/${id}/archive`)
      .set('If-Match', '"1"');
    expect(mismatch.status).toBe(412);
    expect(mismatch.headers.etag).toBe('"2"');
    expect(mismatch.body).toMatchObject({
      code: 'request.version-mismatch',
      details: { version: 2 },
    });
  });

  it('serves both aggregate operations', async () => {
    expect((await request(server).get('/v1/inbox/unread-count')).body).toEqual({ unreadCount: 1 });
    const result = await request(server).post('/v1/inbox/notifications/read-all');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ markedRead: 1, unreadCount: 0 });
  });
});
