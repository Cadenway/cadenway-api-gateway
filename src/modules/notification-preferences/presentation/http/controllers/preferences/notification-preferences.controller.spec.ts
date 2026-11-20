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
import { UpdateNotificationPreferences } from '../../../../application/use-cases/commands/preferences/update-notification-preferences/update-notification-preferences.use-case.js';
import { GetNotificationPreferences } from '../../../../application/use-cases/queries/preferences/get-notification-preferences/get-notification-preferences.use-case.js';
import { NotificationPreferencesController } from './notification-preferences.controller.js';

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

describe('NotificationPreferencesController', () => {
  const read = vi.fn();
  const update = vi.fn();
  const flags = { inApp: true, email: false, mobile: false };
  const preferences = {
    channels: {
      mention: flags,
      assignment: flags,
      comment: flags,
      statusChange: flags,
      dueDate: flags,
      access: flags,
      billing: flags,
    },
    digest: 'daily',
    doNotDisturb: false,
    version: 3,
  };
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationPreferencesController],
      providers: [
        { provide: GetNotificationPreferences, useValue: { execute: read } },
        { provide: UpdateNotificationPreferences, useValue: { execute: update } },
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
    read.mockReset().mockResolvedValue(preferences);
    update.mockReset().mockResolvedValue(preferences);
  });

  afterAll(async () => app.close());

  it.each(['"3"', '*'])('returns the representation for conditional GET %s', async (condition) => {
    const response = await request(server)
      .get('/v1/me/notification-preferences')
      .set('If-None-Match', condition);
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('"3"');
    expect(response.body).toEqual(preferences);
  });

  it.each(['*', '"2", "3"'])('relays If-Match %s without changing it', async (condition) => {
    const response = await request(server)
      .patch('/v1/me/notification-preferences')
      .set('If-Match', condition)
      .send({ digest: 'weekly' });
    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('"3"');
    expect(update).toHaveBeenCalledWith({ digest: 'weekly' }, condition);
  });

  it('returns the current version on a failed precondition', async () => {
    update.mockRejectedValue(
      new ProblemException({
        status: 412,
        code: 'request.version-mismatch',
        details: { service: 'notification-service', version: 3 },
      }),
    );
    const response = await request(server)
      .patch('/v1/me/notification-preferences')
      .set('If-Match', '"1"')
      .send({ digest: 'weekly' });
    expect(response.status).toBe(412);
    expect(response.headers.etag).toBe('"3"');
    expect(response.body).toMatchObject({
      code: 'request.version-mismatch',
      details: { version: 3 },
    });
    const body: { readonly details: Record<string, unknown> } = response.body as {
      readonly details: Record<string, unknown>;
    };
    expect(body.details).not.toHaveProperty('service');
  });

  it('refuses null fields before calling Notification', async () => {
    const response = await request(server)
      .patch('/v1/me/notification-preferences')
      .send({ digest: null });
    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
