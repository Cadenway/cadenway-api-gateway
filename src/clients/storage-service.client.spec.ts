import {
  InternalHttpClient,
  InternalTokenSigner,
  InternalTokenVerifier,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, OrganizationContext } from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { STORAGE_SERVICE, StorageServiceClient } from './storage-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: ['tasks:read', 'tasks:write'],
};
const id = '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f15';
const taskKey = 'CAD-482';
const location = `/internal/v1/tasks/${taskKey}/attachments/${id}`;
const attachment = {
  id,
  taskKey,
  fileName: 'maquette-sso.png',
  contentType: 'image/png',
  sizeBytes: 248320,
  authorUserId: CAMILLE.id,
  uploadedAt: '2026-11-08T08:05:00.000Z',
  version: 1,
};
const intakeProof = {
  organizationId: '019a7005-3b2c-7d4e-8f5a-6b7c8d9e0f18',
  publicationId: '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12',
  attachmentId: id,
  expiresAt: '2026-11-20T14:30:00Z',
};
const intakeDeclaration = { fileName: 'image.png', contentType: 'image/png', sizeBytes: 120 };
const intakePath = `/internal/v1/intake-publications/${intakeProof.publicationId}/attachments`;
const intakeHeaders = { Location: `${intakePath}/${id}`, 'Cache-Control': 'no-store' };
const intakeUpload = {
  id,
  method: 'POST',
  url: 'http://files.example.test:8080/upload',
  fields: { key: 'intake/opaque', 'Content-Type': 'image/png' },
  expiresAt: '2026-11-20T14:05:00Z',
};

describe('StorageServiceClient', () => {
  let signer: InternalTokenSigner;
  let verifier: InternalTokenVerifier;
  let client: StorageServiceClient;
  let answer: Response;
  let calls: { readonly url: string; readonly init: RequestInit | undefined }[];

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
    verifier = await InternalTokenVerifier.create({
      audience: STORAGE_SERVICE,
      trustedIssuers: { [GATEWAY_ISSUER]: [keys.publicJwk] },
    });
  });

  beforeEach(() => {
    calls = [];
    answer = new Response(null, { status: 204 });
    client = new StorageServiceClient(
      new InternalHttpClient({
        service: STORAGE_SERVICE,
        baseUrl: 'http://storage-service.test',
        signer,
        allowedUnavailableProblemCodes: ['storage.unavailable'],
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer);
        },
      }),
    );
  });

  it('strips selected-organization claims from a personal signed transfer', async () => {
    const transfer = {
      uploadId: id,
      method: 'POST',
      url: 'https://files.example.test/uploads',
      fields: { key: 'profile-media/staging/opaque' },
      expiresAt: '2026-11-20T14:05:00Z',
    };
    answer = Response.json(transfer, { headers: { 'Cache-Control': 'no-store' } });
    await expect(
      runWithOrganizationContext(context, () =>
        client.signProfileMediaTransfer(
          id,
          {
            kind: 'avatar',
            expiresAt: transfer.expiresAt,
            contentType: 'image/png',
            sizeBytes: 50,
          },
          'account',
        ),
      ),
    ).resolves.toEqual(transfer);
    const headers = new Headers(calls[0]?.init?.headers);
    const token = await verifier.verify(
      (headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
    );
    expect(token).toMatchObject({
      actor: context.actor,
      organizationId: null,
      role: null,
      scopes: [],
    });
  });

  it('keeps verified tenant claims for a member read and validates returned PNG bytes', async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 11]);
    answer = new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': '9',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    await expect(
      runWithOrganizationContext(context, () =>
        client.getAvatarImage(id, CAMILLE.id, 'organization'),
      ),
    ).resolves.toEqual(Buffer.from(png));
    expect(calls[0]?.url).toContain(`ownerUserId=${CAMILLE.id}`);
    const headers = new Headers(calls[0]?.init?.headers);
    const token = await verifier.verify(
      (headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
    );
    expect(token.organizationId).toBe(ATELIER_NORD_ID);
  });

  it('fails a chunked derivative as soon as the byte limit is exceeded', async () => {
    const chunks = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5 * 1024 * 1024));
        controller.enqueue(Uint8Array.of(0));
        controller.close();
      },
    });
    answer = new Response(chunks, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    await expect(
      runWithOrganizationContext(context, () => client.getOrganizationLogoImage(id)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    expect(calls).toHaveLength(1);
  });

  it('signs a scoped list request and validates the returned page', async () => {
    answer = Response.json({ items: [attachment], nextCursor: null, unexpected: 'discarded' });
    const page = await runWithOrganizationContext(context, () =>
      client.listTaskAttachments(taskKey, { limit: 20 }),
    );
    expect(page).toEqual({ items: [attachment], nextCursor: null });
    expect(calls[0]?.url).toContain('/internal/v1/tasks/CAD-482/attachments?limit=20');
    const authorization = new Headers(calls[0]?.init?.headers).get('Authorization') ?? '';
    const principal = await verifier.verify(authorization.replace(/^Bearer /u, ''));
    expect(principal.organizationId).toBe(ATELIER_NORD_ID);
    expect(principal.actor.id).toBe(CAMILLE.id);
  });

  it('signs an intake upload as a system actor in the tenant proved by Task', async () => {
    answer = Response.json(intakeUpload, { status: 201, headers: intakeHeaders });

    await expect(
      runWithOrganizationContext(context, () =>
        client.startIntakeAttachmentUpload(intakeProof, intakeDeclaration),
      ),
    ).resolves.toEqual(intakeUpload);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`http://storage-service.test${intakePath}`);
    const headers = new Headers(calls[0]?.init?.headers);
    const principal = await verifier.verify(
      (headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
    );
    expect(principal).toMatchObject({
      actor: { type: 'system', id: null },
      organizationId: intakeProof.organizationId,
      role: null,
      scopes: [],
    });
    expect(headers.has('Intake-Draft-Key')).toBe(false);
    expect(headers.has('Idempotency-Key')).toBe(false);
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        attachmentId: intakeProof.attachmentId,
        expiresAt: intakeProof.expiresAt,
        ...intakeDeclaration,
      }),
    );
  });

  it.each([
    { url: 'data:text/plain,example' },
    { url: 'https://user:pass@files.example.test/upload' },
    { url: 'https://files.example.test/upload#fragment' },
    { expiresAt: '2026-11-20T14:31:00Z' },
    { id: '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f16' },
  ])('rejects an unbound or unsafe intake upload response (%j)', async (override) => {
    answer = Response.json(
      { ...intakeUpload, ...override },
      { status: 201, headers: intakeHeaders },
    );

    await expect(
      client.startIntakeAttachmentUpload(intakeProof, intakeDeclaration),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('redacts arbitrary signed field names and values in upstream validation errors', async () => {
    answer = Response.json(
      { ...intakeUpload, fields: { 'example-opaque-field': { value: 'example-opaque-value' } } },
      { status: 201, headers: intakeHeaders },
    );

    await expect(
      client.startIntakeAttachmentUpload(intakeProof, intakeDeclaration),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
      cause: {
        message:
          'storage-service answered startIntakeAttachmentUploadInternal outside its contract: an invalid signed upload response.',
      },
    });
  });

  it('verifies only the scoped intake reservation and refuses an acknowledgement for another file', async () => {
    answer = Response.json({ id: id.toUpperCase() }, { headers: { 'Cache-Control': 'no-store' } });

    await expect(client.completeIntakeAttachmentUpload(intakeProof)).resolves.toEqual({
      id: id.toUpperCase(),
    });
    expect(calls[0]?.url).toBe(`http://storage-service.test${intakePath}/${id}/completion`);
    expect(calls[0]?.init?.method).toBe('POST');
    const headers = new Headers(calls[0]?.init?.headers);
    const principal = await verifier.verify(
      (headers.get('Authorization') ?? '').replace(/^Bearer /u, ''),
    );
    expect(principal).toMatchObject({
      actor: { type: 'system', id: null },
      organizationId: intakeProof.organizationId,
    });

    answer = Response.json(
      { id: '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f16' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    await expect(client.completeIntakeAttachmentUpload(intakeProof)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('does not retry intake completion and exposes only the Storage unavailable code', async () => {
    answer = Response.json(
      {
        type: 'about:blank',
        title: 'Unavailable',
        status: 503,
        code: 'storage.unavailable',
        details: { provider: 'internal-test' },
      },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );

    await expect(client.completeIntakeAttachmentUpload(intakeProof)).rejects.toMatchObject({
      problem: { status: 503, code: 'storage.unavailable', details: { service: STORAGE_SERVICE } },
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['storage.unavailable', 'storage.unavailable'],
    ['internal.unexpected', 'upstream.unavailable'],
  ])('handles a Storage 503 with code %s as %s', async (code, expected) => {
    answer = Response.json(
      {
        type: 'https://storage-service.test/problems/unavailable',
        title: 'Unavailable',
        status: 503,
        code,
        detail: 'Object provider diagnostic',
        details: { provider: 'internal-test' },
      },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.getTaskAttachmentDownload(taskKey, id)),
    ).rejects.toMatchObject({
      problem: { status: 503, code: expected, details: { service: STORAGE_SERVICE } },
    });
    expect(calls).toHaveLength(1);
  });

  it('relays an idempotency key, validates the location and does not cache the capability', async () => {
    const upload = {
      id,
      method: 'POST',
      url: 'https://storage.example.test/upload',
      fields: { key: 'private' },
      expiresAt: '2026-11-08T08:10:00.000Z',
    };
    answer = Response.json(upload, {
      status: 201,
      headers: { Location: location, 'Cache-Control': 'no-store' },
    });
    const result = await runWithOrganizationContext(context, () =>
      client.startTaskAttachmentUpload(
        taskKey,
        { fileName: 'image.png', contentType: 'image/png', sizeBytes: 1 },
        'request-key',
      ),
    );
    expect(result).toEqual(upload);
    expect(new Headers(calls[0]?.init?.headers).get('Idempotency-Key')).toBe('request-key');
  });

  it('rejects an attachment page that contains an item from another task', async () => {
    answer = Response.json({ items: [{ ...attachment, taskKey: 'CAD-1' }], nextCursor: null });
    await expect(
      runWithOrganizationContext(context, () => client.listTaskAttachments(taskKey, {})),
    ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
  });

  it('requires no-store on the signed download', async () => {
    const body = {
      url: 'https://storage.example.test/download',
      expiresAt: '2026-11-08T08:10:00.000Z',
    };
    answer = Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
    await expect(
      runWithOrganizationContext(context, () => client.getTaskAttachmentDownload(taskKey, id)),
    ).resolves.toEqual(body);
    answer = Response.json(body);
    await expect(
      runWithOrganizationContext(context, () => client.getTaskAttachmentDownload(taskKey, id)),
    ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
  });

  it('rejects a capability with an inconsistent location or missing cache protection', async () => {
    const body = {
      id,
      method: 'POST',
      url: 'https://storage.example.test/upload',
      fields: { key: 'private' },
      expiresAt: '2026-11-08T08:10:00.000Z',
    };
    const cases: readonly HeadersInit[] = [
      { Location: location },
      { Location: '/internal/v1/tasks/CAD-1/attachments/other', 'Cache-Control': 'no-store' },
    ];
    for (const headers of cases) {
      answer = Response.json(body, { status: 201, headers });
      await expect(
        runWithOrganizationContext(context, () =>
          client.startTaskAttachmentUpload(taskKey, {
            fileName: 'image.png',
            contentType: 'image/png',
            sizeBytes: 1,
          }),
        ),
      ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
    }
  });

  it('requires the correct attachment identity and matching strong ETag', async () => {
    answer = Response.json(attachment, { headers: { ETag: '"1"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getTaskAttachment(taskKey, id)),
    ).resolves.toEqual(attachment);
    answer = Response.json(attachment, { headers: { ETag: '"2"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getTaskAttachment(taskKey, id)),
    ).rejects.toMatchObject({ problem: { code: 'upstream.failed' } });
  });

  it('sends a conditional deletion once', async () => {
    await runWithOrganizationContext(context, () =>
      client.deleteTaskAttachment(taskKey, id, '"1"'),
    );
    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0]?.init?.headers).get('If-Match')).toBe('"1"');
  });

  it.each([
    (storage: StorageServiceClient) => storage.listTaskAttachments(taskKey, {}),
    (storage: StorageServiceClient) => storage.getTaskAttachment(taskKey, id),
    (storage: StorageServiceClient) => storage.getTaskAttachmentDownload(taskKey, id),
  ])('does not retry a transient failure after a Task access decision', async (operation) => {
    answer = Response.json(
      { status: 503, code: 'upstream.unavailable' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );

    await expect(runWithOrganizationContext(context, () => operation(client))).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it.each(['TimeoutError', 'AbortError'])(
    'maps a %s while reading the response body to an upstream timeout',
    async (name) => {
      answer = new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException('private object location', name));
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
      await expect(
        runWithOrganizationContext(context, () => client.listTaskAttachments(taskKey, {})),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.timeout' } });
      expect(calls).toHaveLength(1);
    },
  );
});
