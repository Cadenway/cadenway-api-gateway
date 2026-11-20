import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DocumentServiceClient } from '../../../../../../clients/document-service.client.js';
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
import type { DocumentsPort } from '../../../../application/ports/outbound/document-service/documents/documents.port.js';
import { CreateDocument } from '../../../../application/use-cases/commands/documents/create-document/create-document.use-case.js';
import { DeleteDocument } from '../../../../application/use-cases/commands/documents/delete-document/delete-document.use-case.js';
import { UpdateDocument } from '../../../../application/use-cases/commands/documents/update-document/update-document.use-case.js';
import { GetDocument } from '../../../../application/use-cases/queries/documents/get-document/get-document.use-case.js';
import { ListDocuments } from '../../../../application/use-cases/queries/documents/list-documents/list-documents.use-case.js';
import { DocumentsController } from './documents.controller.js';

const documentId = '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17';
const spaceId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const document = {
  id: documentId,
  spaceId,
  title: 'Notes',
  body: '# Notes',
  authorUserId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: '2026-11-09T17:20:00Z',
  version: 3,
};

function fixture() {
  const port = {
    list: vi.fn().mockResolvedValue({ items: [document], nextCursor: null }),
    create: vi.fn().mockResolvedValue(document),
    get: vi.fn().mockResolvedValue(document),
    update: vi.fn().mockResolvedValue(document),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const documents: DocumentsPort = port;
  const controller = new DocumentsController(
    new ListDocuments(documents),
    new CreateDocument(documents),
    new GetDocument(documents),
    new UpdateDocument(documents),
    new DeleteDocument(documents),
  );
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as Response;
  return { controller, port, response, setHeader };
}

describe('document public routes', () => {
  it('forwards all operations and derives public headers from validated bodies', async () => {
    const { controller, port, response, setHeader } = fixture();
    const page = await controller.list({ limit: 50 }, response);
    expect(page.items[0]).not.toHaveProperty('body');
    await controller.create({ spaceId, title: 'Notes' }, 'create-key', response);
    await controller.get({ documentId }, response);
    await controller.update({ documentId }, { body: '# Revised' }, '"3"', response);
    await controller.remove({ documentId }, '"3"', response);
    expect(port.create).toHaveBeenCalledWith({ spaceId, title: 'Notes' }, 'create-key');
    expect(port.update).toHaveBeenCalledWith(documentId, { body: '# Revised' }, '"3"');
    expect(port.remove).toHaveBeenCalledWith(documentId, '"3"');
    expect(setHeader).toHaveBeenCalledWith('Location', `/v1/documents/${documentId}`);
    expect(setHeader).toHaveBeenCalledWith('ETag', '"3"');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it.each([undefined, '*', 'W/"3"', '"2", "3"', '"03"'])(
    'refuses an invalid strong precondition %s before forwarding',
    async (header) => {
      const { controller, port, response } = fixture();
      await expect(controller.remove({ documentId }, header, response)).rejects.toMatchObject({
        problem: { status: 400, code: 'request.invalid' },
      });
      expect(port.remove).not.toHaveBeenCalled();
    },
  );

  it('refuses a result for another document', async () => {
    const { controller, port, response } = fixture();
    port.get.mockResolvedValueOnce({ ...document, id: '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f18' });
    await expect(controller.get({ documentId }, response)).rejects.toMatchObject({
      problem: { status: 503 },
    });
  });

  it.each(['create', 'update'] as const)(
    'preserves a body-too-large rejection from Document on %s',
    async (operation) => {
      const { controller, port, response } = fixture();
      port[operation].mockRejectedValueOnce(
        new ProblemException({ status: 400, code: 'request.body-too-large' }),
      );
      const call =
        operation === 'create'
          ? () => controller.create({ spaceId, title: 'Notes' }, undefined, response)
          : () => controller.update({ documentId }, { title: 'Notes' }, '"3"', response);
      await expect(call()).rejects.toMatchObject({
        problem: { status: 400, code: 'request.body-too-large' },
      });
    },
  );

  it.each([
    ['upstream.unavailable', 'upstream.failed'],
    ['upstream.circuit-open', 'upstream.failed'],
    ['upstream.deadline-exceeded', 'upstream.timeout'],
    ['document.unavailable', 'document.unavailable'],
  ])('maps %s to the published %s', async (internalCode, publicCode) => {
    const { controller, port, response } = fixture();
    port.get.mockRejectedValueOnce(
      new ProblemException({ status: 503, code: internalCode, details: { title: 'private' } }),
    );
    try {
      await controller.get({ documentId }, response);
      throw new Error('Expected a dependency failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProblemException);
      if (!(error instanceof ProblemException)) throw error;
      expect(error.problem).toMatchObject({ status: 503, code: publicCode });
      expect(error.problem.details).toBeUndefined();
    }
  });

  it('conceals details from an inaccessible resource', async () => {
    const { controller, port, response } = fixture();
    port.get.mockRejectedValueOnce(
      new ProblemException({
        status: 404,
        code: 'document.not-found',
        details: { title: 'private' },
      }),
    );
    await expect(controller.get({ documentId }, response)).rejects.toMatchObject({
      problem: { status: 404, code: 'document.not-found' },
    });
  });
});

describe('document HTTP validation and guards', () => {
  let application: RouteApplication;
  const session = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;
  const client = {
    listDocuments: vi.fn().mockResolvedValue({ items: [document], nextCursor: null }),
    createDocument: vi.fn().mockResolvedValue(document),
    getDocument: vi.fn().mockResolvedValue(document),
    updateDocument: vi.fn().mockResolvedValue(document),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    application = await createRouteApplication(createFakeIdentity());
    Object.assign(application.app.get(DocumentServiceClient), client);
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('uses session-only auth, CSRF and the required strong write precondition', async () => {
    const token = await request(application.server)
      .get('/v1/documents')
      .set('Authorization', `Bearer ${MEMBERS_TOKEN}`);
    expect(token.status).toBe(403);
    expect(token.body as unknown).toMatchObject({ code: 'auth.api-token-not-accepted' });
    const csrf = await request(application.server)
      .post('/v1/documents')
      .set('Cookie', session)
      .send({ spaceId, title: 'Notes' });
    expect(csrf.status).toBe(403);
    const invalid = await request(application.server)
      .patch(`/v1/documents/${documentId}`)
      .set('Cookie', session)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '*')
      .send({ title: 'Notes' });
    expect(invalid.status).toBe(400);
    expect(client.updateDocument).not.toHaveBeenCalled();
    expect(invalid.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects unknown query keys and an empty merge patch before calling Document', async () => {
    const query = await request(application.server)
      .get('/v1/documents')
      .set('Cookie', session)
      .query({ unknown: 'value' });
    expect(query.status).toBe(400);
    expect(client.listDocuments).not.toHaveBeenCalled();
    const patch = await request(application.server)
      .patch(`/v1/documents/${documentId}`)
      .set('Cookie', session)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '"3"')
      .send({});
    expect(patch.status).toBe(400);
    expect(client.updateDocument).not.toHaveBeenCalled();
  });

  it('keeps conditional reads private and rechecks the document upstream', async () => {
    const result = await request(application.server)
      .get(`/v1/documents/${documentId}`)
      .set('Cookie', session)
      .set('If-None-Match', '*');
    expect(result.status).toBe(200);
    expect(result.headers.etag).toBe('"3"');
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(client.getDocument).toHaveBeenCalledWith(documentId);
  });
});
