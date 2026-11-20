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
import type { ReminderOperations } from '../../../../application/ports/outbound/notification-service/reminder/reminder-operations.port.js';
import { AccessReminder } from '../../../../application/use-cases/queries/reminder/access-reminder/access-reminder.use-case.js';
import { ListReminders } from '../../../../application/use-cases/queries/reminder/list-reminders/list-reminders.use-case.js';
import { RemindersController } from './reminders.controller.js';

/** Serializes problems for isolated route tests. */
@Catch(ProblemException)
class TestProblemFilter implements ExceptionFilter {
  // #region Methods
  /** Preserves the status and body from a public problem. */
  public catch(error: ProblemException, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(error.problem.status).json(error.problem);
  }
  // #endregion
}

describe('RemindersController', () => {
  const taskId = '019a7002-3c4d-7e5f-8a6b-7c8d9e0f1a23';
  const reminderId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e12';
  const task = { taskId, taskKey: 'CAD-482', taskName: 'Current task' };
  const record = {
    id: reminderId,
    taskId,
    remindAt: '2026-11-08T14:00:00Z',
    note: null,
    firedAt: null,
    completedAt: null,
    version: 3,
  };
  const candidate = vi.fn();
  const get = vi.fn();
  const getTask = vi.fn();
  const setTask = vi.fn();
  const update = vi.fn();
  const remove = vi.fn();
  const snooze = vi.fn();
  const complete = vi.fn();
  const lookup = vi.fn();
  const lookupKey = vi.fn();
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const operations: ReminderOperations = {
      candidate,
      get,
      getTask,
      setTask,
      update,
      remove,
      snooze,
      complete,
    };
    const module = await Test.createTestingModule({
      controllers: [RemindersController],
      providers: [
        {
          provide: AccessReminder,
          useValue: new AccessReminder(operations, { lookup }, lookupKey),
        },
        { provide: ListReminders, useValue: { execute: vi.fn() } },
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
    vi.clearAllMocks();
    candidate.mockResolvedValue({ id: reminderId, taskId });
    lookup.mockResolvedValue([{ visible: true, display: task }]);
    lookupKey.mockResolvedValue(task);
    get.mockResolvedValue(record);
    getTask.mockResolvedValue(record);
    setTask.mockResolvedValue({ reminder: record, created: true });
    update.mockResolvedValue(record);
    snooze.mockResolvedValue(record);
    complete.mockResolvedValue(record);
  });

  afterAll(async () => app.close());

  it('checks the exact task before exposing an owner reminder', async () => {
    const response = await request(server)
      .get(`/v1/reminders/${reminderId}`)
      .set('If-None-Match', '"3"');
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('"3"');
    expect(response.body).toMatchObject({
      id: reminderId,
      taskKey: 'CAD-482',
      taskName: 'Current task',
    });
    expect(candidate).toHaveBeenCalledWith(reminderId);
    expect(lookup.mock.invocationCallOrder[0]).toBeLessThan(get.mock.invocationCallOrder[0] ?? 0);
    expect(get).toHaveBeenCalledWith(reminderId, taskId);
  });

  it('does not read a reminder once its task is hidden', async () => {
    lookup.mockResolvedValue([{ visible: false }]);
    const response = await request(server).get(`/v1/reminders/${reminderId}`);
    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it.each([
    { method: 'get', suffix: '', status: 200 },
    { method: 'patch', suffix: '', status: 200, body: { note: null } },
    { method: 'delete', suffix: '', status: 204 },
    { method: 'post', suffix: '/snooze', status: 200, body: { remindAt: record.remindAt } },
    { method: 'post', suffix: '/complete', status: 200 },
  ] as const)('canonicalizes an uppercase reminder UUID on $method $suffix', async (test) => {
    const pending = request(server)[test.method](
      `/v1/reminders/${reminderId.toUpperCase()}${test.suffix}`,
    );
    const response = await ('body' in test ? pending.send(test.body) : pending);
    expect(response.status).toBe(test.status);
    expect(candidate).toHaveBeenCalledExactlyOnceWith(reminderId);
    if (test.status === 200) expect(response.body).toMatchObject({ id: reminderId });
  });

  it('creates against the checked task and returns the public location', async () => {
    const response = await request(server)
      .put('/v1/tasks/CAD-482/reminder')
      .set('If-Match', '*')
      .send({ remindAt: record.remindAt, note: null });
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/v1/reminders/${reminderId}`);
    expect(response.headers.etag).toBe('"3"');
    expect(setTask).toHaveBeenCalledWith(taskId, { remindAt: record.remindAt, note: null }, '*');
  });

  it('returns the current ETag for a failed reminder precondition', async () => {
    update.mockRejectedValue(
      new ProblemException({
        status: 412,
        code: 'request.version-mismatch',
        details: { service: 'notification-service', version: 3 },
      }),
    );
    const response = await request(server)
      .patch(`/v1/reminders/${reminderId}`)
      .set('If-Match', '"1"')
      .send({ note: null });
    expect(response.status).toBe(412);
    expect(response.headers.etag).toBe('"3"');
  });
});
