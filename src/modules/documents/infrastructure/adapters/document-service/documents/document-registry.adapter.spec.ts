import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import { describe, expect, it, vi } from 'vitest';

import { createDocumentRegistryAdapter } from './document-registry.adapter.js';

const documentId = '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17';
const spaceId = '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01';
const privateText = 'PRIVATE_DOCUMENT_MARKDOWN_FIXTURE';

function rejectingAdapter(
  status: ProblemStatus,
  code: string,
  details: Readonly<Record<string, unknown>>,
): ReturnType<typeof createDocumentRegistryAdapter> {
  const failure = new ProblemException({
    status,
    code,
    title: privateText,
    detail: privateText,
    details: { ...details, internal: privateText },
    cause: new Error(privateText),
  });
  return createDocumentRegistryAdapter({
    listDocuments: vi.fn().mockRejectedValue(failure),
    createDocument: vi.fn().mockRejectedValue(failure),
    getDocument: vi.fn().mockRejectedValue(failure),
    updateDocument: vi.fn().mockRejectedValue(failure),
    deleteDocument: vi.fn().mockRejectedValue(failure),
  });
}

describe('Document registry adapter', () => {
  it('relays catalog cursors, create keys and write preconditions to the owning service', async () => {
    const metadata = {
      id: documentId,
      spaceId,
      authorUserId: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
      title: 'Release notes',
      createdAt: '2026-11-07T08:00:00Z',
      updatedAt: '2026-11-07T08:00:00Z',
      version: 1,
    };
    const detail = { ...metadata, body: '# Release notes' };
    const page = { items: [metadata], nextCursor: 'next-page' };
    const client = {
      listDocuments: vi.fn().mockResolvedValue(page),
      createDocument: vi.fn().mockResolvedValue(detail),
      getDocument: vi.fn().mockResolvedValue(detail),
      updateDocument: vi.fn().mockResolvedValue(detail),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    };
    const documents = createDocumentRegistryAdapter(client);
    const query = { q: 'release', cursor: 'current-page', limit: 5 };
    const create = { spaceId: metadata.spaceId, title: metadata.title, body: detail.body };
    const patch = { body: '' };

    await expect(documents.list(query)).resolves.toEqual(page);
    await expect(documents.create(create, 'create-key')).resolves.toEqual(detail);
    await expect(documents.get(metadata.id)).resolves.toEqual(detail);
    await expect(documents.update(metadata.id, patch, '"1"')).resolves.toEqual(detail);
    await expect(documents.remove(metadata.id, '"2"')).resolves.toBeUndefined();

    expect(client.listDocuments).toHaveBeenCalledExactlyOnceWith(query);
    expect(client.createDocument).toHaveBeenCalledExactlyOnceWith(create, 'create-key');
    expect(client.getDocument).toHaveBeenCalledExactlyOnceWith(metadata.id);
    expect(client.updateDocument).toHaveBeenCalledExactlyOnceWith(metadata.id, patch, '"1"');
    expect(client.deleteDocument).toHaveBeenCalledExactlyOnceWith(metadata.id, '"2"');
  });

  it('preserves only validation issues with known fields and codes using a fixed message', async () => {
    const documents = rejectingAdapter(400, 'request.invalid', {
      issues: [
        {
          in: 'query',
          path: 'cursor',
          code: 'invalid_cursor',
          message: privateText,
          received: privateText,
        },
        { in: 'query', path: privateText, code: 'invalid_type', message: privateText },
        { in: 'query', path: 'q', code: privateText, message: privateText },
        { in: 'header', path: 'Authorization', code: 'invalid_format', message: privateText },
      ],
    });
    const failure = await documents.list({ limit: 5 }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ProblemException);
    expect(failure).toHaveProperty('problem', {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'request.invalid',
      details: {
        issues: [
          { in: 'query', path: 'cursor', code: 'invalid_cursor', message: 'Invalid value.' },
        ],
      },
    });
    expect(failure).not.toHaveProperty('cause', expect.any(Error));
  });

  it.each([
    {},
    { issues: [] },
    { issues: [{ in: 'header', path: 'Authorization', code: 'invalid_format' }] },
  ])('fails safely if no valid validation issue remains', async (details) => {
    const documents = rejectingAdapter(400, 'request.invalid', details);

    await expect(documents.list({ limit: 5 })).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('forwards a document body size refusal without upstream details', async () => {
    const documents = rejectingAdapter(400, 'request.body-too-large', { limit: privateText });
    const failure = await documents
      .create({ spaceId, title: 'Notes' }, undefined)
      .catch((error: unknown) => error);

    expect(failure).toMatchObject({ problem: { status: 400, code: 'request.body-too-large' } });
    expect(failure).not.toHaveProperty('problem.details');
  });

  it('keeps only the access refusal roles on writes', async () => {
    const documents = rejectingAdapter(403, 'access.role-insufficient', {
      role: 'comment',
      requiredRole: 'edit',
    });
    const malformed = rejectingAdapter(403, 'access.role-insufficient', {
      role: privateText,
      requiredRole: 'edit',
    });

    await expect(documents.create({ spaceId, title: 'Notes' }, undefined)).rejects.toHaveProperty(
      'problem.details',
      { role: 'comment', requiredRole: 'edit' },
    );
    await expect(documents.get(documentId)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    await expect(malformed.remove(documentId, '"1"')).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('keeps only a positive safe version on conditional writes', async () => {
    const documents = rejectingAdapter(412, 'request.version-mismatch', { version: 3 });
    const malformed = rejectingAdapter(412, 'request.version-mismatch', {
      version: Number.MAX_SAFE_INTEGER + 1,
    });

    await expect(documents.update(documentId, { title: 'Notes' }, '"1"')).rejects.toHaveProperty(
      'problem.details',
      { version: 3 },
    );
    await expect(documents.create({ spaceId, title: 'Notes' }, undefined)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
    await expect(malformed.remove(documentId, '"1"')).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it.each([
    [404, 'document.not-found'],
    [409, 'idempotency.request-in-progress'],
    [422, 'idempotency.key-reused'],
    [503, 'document.unavailable'],
  ] as const)('keeps %i %s without any upstream diagnostics', async (status, code) => {
    const failure = await rejectingAdapter(status, code, { version: 3 })
      .get(documentId)
      .catch((error: unknown) => error);

    expect(failure).toHaveProperty('problem.status', status);
    expect(failure).toHaveProperty('problem.code', code);
    expect(failure).not.toHaveProperty('problem.details');
    expect(failure).not.toHaveProperty('problem.detail');
    expect(failure).not.toHaveProperty('problem.title', privateText);
  });

  it('drops an unrecognized owner code before public error translation', async () => {
    await expect(rejectingAdapter(409, privateText, {}).get(documentId)).rejects.toHaveProperty(
      'problem.code',
      'upstream.error',
    );
  });
});
