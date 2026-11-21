import { ProblemException } from '@cadenway/nest-common';
import type { Request, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import {
  CAMILLE_ORGANIZATION_TOKEN,
  MEMBERS_TOKEN,
  createFakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';
import type { AttachmentRegistry } from '../../../../application/ports/outbound/storage-service/attachment/attachment-registry.port.js';
import { ListAttachments } from '../../../../application/use-cases/queries/attachment/list-attachments/list-attachments.use-case.js';
import { StartAttachmentUpload } from '../../../../application/use-cases/commands/attachment/start-attachment-upload/start-attachment-upload.use-case.js';
import { GetAttachment } from '../../../../application/use-cases/queries/attachment/get-attachment/get-attachment.use-case.js';
import { CompleteAttachmentUpload } from '../../../../application/use-cases/commands/attachment/complete-attachment-upload/complete-attachment-upload.use-case.js';
import { GetAttachmentDownload } from '../../../../application/use-cases/queries/attachment/get-attachment-download/get-attachment-download.use-case.js';
import { DeleteAttachment } from '../../../../application/use-cases/commands/attachment/delete-attachment/delete-attachment.use-case.js';
import { TaskAttachmentController } from './task-attachment.controller.js';

const taskKey = 'CAD-482';
const plainRequest = { headers: {} } as Request;
const attachmentId = '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f15';
const attachment = {
  id: attachmentId,
  taskKey,
  fileName: 'capture.png',
  contentType: 'image/png',
  sizeBytes: 100,
  authorUserId: null,
  uploadedAt: '2026-11-20T10:00:00Z',
  version: 3,
};
const capability = {
  id: attachmentId,
  method: 'POST',
  url: 'https://files.example.test/upload',
  fields: { key: 'fixture' },
  expiresAt: '2026-11-20T10:05:00Z',
};

function fixture() {
  const port = {
    authorize: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [attachment], nextCursor: null }),
    start: vi.fn().mockResolvedValue(capability),
    get: vi.fn().mockResolvedValue(attachment),
    complete: vi.fn().mockResolvedValue(attachment),
    download: vi.fn().mockResolvedValue({
      url: 'https://files.example.test/download',
      expiresAt: capability.expiresAt,
    }),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const registry: AttachmentRegistry = port;
  const controller = new TaskAttachmentController(
    new ListAttachments(registry),
    new StartAttachmentUpload(registry),
    new GetAttachment(registry),
    new CompleteAttachmentUpload(registry),
    new GetAttachmentDownload(registry),
    new DeleteAttachment(registry),
  );
  const setHeader = vi.fn();
  return { controller, port, setHeader, response: { setHeader } as unknown as Response };
}

describe('task attachment operations', () => {
  it('checks current task access before every Storage request', async () => {
    const { controller, port, response } = fixture();
    const params = { taskKey, attachmentId };
    await controller.list({ taskKey }, { limit: 50 }, plainRequest);
    await controller.start(
      { taskKey },
      { fileName: 'capture.png', contentType: 'image/png', sizeBytes: 100 },
      'key',
      response,
    );
    await controller.get(params, response, plainRequest);
    await controller.complete(params, response);
    await controller.download(params, response, plainRequest);
    await controller.remove(params, '"3"');
    expect(port.authorize.mock.calls).toEqual([
      [taskKey, 'read'],
      [taskKey, 'write'],
      [taskKey, 'read'],
      [taskKey, 'write'],
      [taskKey, 'read'],
      [taskKey, 'write'],
    ]);
    for (const method of [
      port.list,
      port.start,
      port.get,
      port.complete,
      port.download,
      port.remove,
    ]) {
      const index = [
        port.list,
        port.start,
        port.get,
        port.complete,
        port.download,
        port.remove,
      ].indexOf(method);
      expect(port.authorize.mock.invocationCallOrder[index]).toBeLessThan(
        method.mock.invocationCallOrder[0] ?? 0,
      );
    }
    expect(port.start).toHaveBeenCalledWith(taskKey, expect.any(Object), 'key');
    expect(port.remove).toHaveBeenCalledWith(taskKey, attachmentId, '"3"');
  });

  it('does not call Storage after denied task access', async () => {
    const { controller, port } = fixture();
    port.authorize.mockRejectedValueOnce(
      new ProblemException({ status: 404, code: 'task.not-found', details: { name: 'private' } }),
    );
    await expect(controller.list({ taskKey }, { limit: 50 }, plainRequest)).rejects.toMatchObject({
      problem: { status: 404, code: 'task.not-found' },
    });
    expect(port.list).not.toHaveBeenCalled();
  });

  it('returns the public Location, ETag and non-cacheable capabilities', async () => {
    const { controller, response, setHeader } = fixture();
    await controller.start(
      { taskKey },
      { fileName: 'capture.png', contentType: 'image/png', sizeBytes: 100 },
      undefined,
      response,
    );
    await controller.get({ taskKey, attachmentId }, response, plainRequest);
    await controller.complete({ taskKey, attachmentId }, response);
    await controller.download({ taskKey, attachmentId }, response, plainRequest);
    expect(setHeader).toHaveBeenCalledWith(
      'Location',
      `/v1/tasks/${taskKey}/attachments/${attachmentId}`,
    );
    expect(setHeader).toHaveBeenCalledWith('ETag', '"3"');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('rejects metadata for another task or attachment', async () => {
    const { controller, port, response } = fixture();
    port.get.mockResolvedValueOnce({ ...attachment, taskKey: 'CAD-483' });
    await expect(
      controller.get({ taskKey, attachmentId }, response, plainRequest),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    port.list.mockResolvedValueOnce({
      items: [{ ...attachment, taskKey: 'CAD-483' }],
      nextCursor: null,
    });
    await expect(controller.list({ taskKey }, { limit: 50 }, plainRequest)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});

describe('attachment HTTP guards', () => {
  let application: RouteApplication;
  const storage = {
    listTaskAttachments: vi.fn().mockResolvedValue({ items: [attachment], nextCursor: null }),
    startTaskAttachmentUpload: vi.fn().mockResolvedValue(capability),
    getTaskAttachment: vi.fn().mockResolvedValue(attachment),
    completeTaskAttachmentUpload: vi.fn().mockResolvedValue(attachment),
    getTaskAttachmentDownload: vi.fn().mockResolvedValue({
      url: 'https://files.example.test/download',
      expiresAt: capability.expiresAt,
    }),
    deleteTaskAttachment: vi.fn().mockResolvedValue(undefined),
  };
  const base = `/v1/tasks/${taskKey}/attachments`;
  const session = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;

  beforeAll(async () => {
    application = await createRouteApplication(createFakeIdentity());
    Object.assign(application.app.get(StorageServiceClient), storage);
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('serves all six routes with the required Task access mode and capability headers', async () => {
    const list = await request(application.server).get(base).set('Cookie', session);
    expect(list.status).toBe(200);
    const created = await request(application.server)
      .post(base)
      .set('Cookie', session)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ fileName: 'capture.png', contentType: 'image/png', sizeBytes: 100 });
    expect(created.status).toBe(201);
    expect(created.headers['cache-control']).toBe('no-store');
    expect(created.headers.location).toBe(`${base}/${attachmentId}`);
    const read = await request(application.server)
      .get(`${base}/${attachmentId}`)
      .set('Cookie', session);
    expect(read.status).toBe(200);
    expect(read.headers.etag).toBe('"3"');
    const completed = await request(application.server)
      .post(`${base}/${attachmentId}/completion`)
      .set('Cookie', session)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json');
    expect(completed.status).toBe(200);
    const downloaded = await request(application.server)
      .get(`${base}/${attachmentId}/download`)
      .set('Cookie', session);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['cache-control']).toBe('no-store');
    const removed = await request(application.server)
      .delete(`${base}/${attachmentId}`)
      .set('Cookie', session)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '"3"');
    expect(removed.status).toBe(204);
  });

  it('refuses a token without task scope before calling either upstream service', async () => {
    const before = application.task.checkTaskAttachmentAccess.mock.calls.length;
    const result = await request(application.server)
      .get(base)
      .set('Authorization', `Bearer ${MEMBERS_TOKEN}`);
    expect(result.status).toBe(403);
    expect(result.body as unknown).toMatchObject({ code: 'auth.scope-missing' });
    expect(application.task.checkTaskAttachmentAccess).toHaveBeenCalledTimes(before);
  });

  it.each([
    { name: 'list', path: base },
    { name: 'metadata', path: `${base}/${attachmentId}` },
    { name: 'download', path: `${base}/${attachmentId}/download` },
  ])('returns the full $name body for conditional GETs', async ({ path }) => {
    const initial = await request(application.server).get(path).set('Cookie', session);
    expect(initial.status).toBe(200);
    const etag: string = '"3"';

    for (const value of [etag, '*']) {
      const conditional = await request(application.server)
        .get(path)
        .set('Cookie', session)
        .set('If-None-Match', value);
      expect(conditional.status).toBe(200);
      expect(conditional.body as unknown).toEqual(initial.body as unknown);
      if (path === `${base}/${attachmentId}`) expect(conditional.headers.etag).toBe(etag);
      if (path.endsWith('/download')) expect(conditional.headers['cache-control']).toBe('no-store');
    }
  });

  it('masks a missing task and refuses unexpected query keys before Storage', async () => {
    const before = storage.listTaskAttachments.mock.calls.length;
    application.task.checkTaskAttachmentAccess.mockRejectedValueOnce(
      new ProblemException({ status: 404, code: 'task.not-found', details: { name: 'private' } }),
    );
    const hidden = await request(application.server).get(base).set('Cookie', session);
    expect(hidden.status).toBe(404);
    expect(hidden.body as unknown).toMatchObject({ code: 'task.not-found' });
    expect(hidden.body as unknown).not.toHaveProperty('details.name');
    expect(storage.listTaskAttachments).toHaveBeenCalledTimes(before);

    const invalid = await request(application.server)
      .get(base)
      .query({ unexpected: 'value' })
      .set('Cookie', session);
    expect(invalid.status).toBe(400);
    expect(storage.listTaskAttachments).toHaveBeenCalledTimes(before);
  });
});
