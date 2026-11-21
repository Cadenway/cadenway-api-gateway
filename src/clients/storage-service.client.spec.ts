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
