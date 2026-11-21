import {
  InternalHttpClient,
  InternalTokenSigner,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, OrganizationContext } from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { DOCUMENT_SERVICE, DocumentServiceClient } from './document-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};
const document = {
  id: '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f17',
  spaceId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01',
  title: 'Notes',
  body: 'Private source',
  authorUserId: CAMILLE.id,
  createdAt: '2026-11-07T08:00:00Z',
  updatedAt: '2026-11-07T08:00:00Z',
  version: 1,
};
const privateHeaders = { 'Cache-Control': 'private, no-store', ETag: '"1"' };

describe('DocumentServiceClient', () => {
  let signer: InternalTokenSigner;
  let answer: Response;
  let calls: { url: string; init?: RequestInit }[];
  let client: DocumentServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
  });

  beforeEach(() => {
    calls = [];
    answer = Response.json(document, { headers: privateHeaders });
    client = new DocumentServiceClient(
      new InternalHttpClient({
        service: DOCUMENT_SERVICE,
        baseUrl: 'http://document-service.test',
        signer,
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer);
        },
      }),
    );
  });

  it('sends the signed user request and validates the returned document', async () => {
    await expect(
      runWithOrganizationContext(context, () => client.getDocument(document.id)),
    ).resolves.toEqual(document);
    expect(calls[0]?.url).toContain(`/internal/v1/documents/${document.id}`);
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toMatch(/^Bearer /u);
  });

  it('rejects missing cache protection, a mismatched ETag or a different document', async () => {
    answer = Response.json(document, { headers: { ETag: '"1"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getDocument(document.id)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });

    answer = Response.json(document, { headers: { ...privateHeaders, ETag: '"2"' } });
    await expect(
      runWithOrganizationContext(context, () => client.getDocument(document.id)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });

    answer = Response.json(
      { ...document, id: '019a7005-4b2c-7d4e-8f5a-6b7c8d9e0f18' },
      { headers: privateHeaders },
    );
    await expect(
      runWithOrganizationContext(context, () => client.getDocument(document.id)),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('requires the creation location and forwards the original idempotency key', async () => {
    answer = Response.json(document, {
      status: 201,
      headers: { ...privateHeaders, Location: `/internal/v1/documents/${document.id}` },
    });
    await expect(
      runWithOrganizationContext(context, () =>
        client.createDocument({ spaceId: document.spaceId, title: document.title }, 'one-key'),
      ),
    ).resolves.toEqual(document);
    expect(new Headers(calls[0]?.init?.headers).get('Idempotency-Key')).toBe('one-key');

    answer = Response.json(document, { status: 201, headers: privateHeaders });
    await expect(
      runWithOrganizationContext(context, () =>
        client.createDocument({ spaceId: document.spaceId, title: document.title }),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });

    answer = Response.json(
      { ...document, spaceId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02' },
      {
        status: 201,
        headers: { ...privateHeaders, Location: `/internal/v1/documents/${document.id}` },
      },
    );
    await expect(
      runWithOrganizationContext(context, () =>
        client.createDocument({ spaceId: document.spaceId, title: document.title }),
      ),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('rejects list pages with duplicate ids or more records than requested', async () => {
    answer = Response.json(
      { items: [document, document], nextCursor: null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.listDocuments({ limit: 1 })),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('returns an authorized metadata page and preserves the normalized query', async () => {
    answer = Response.json(
      { items: [document], nextCursor: null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    const page = await runWithOrganizationContext(context, () =>
      client.listDocuments({ q: 'notes', limit: 10 }),
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).not.toHaveProperty('body');
    expect(calls[0]?.url).toContain('q=notes');
  });

  it('sends one conditional update and accepts an uncacheable delete', async () => {
    await expect(
      runWithOrganizationContext(context, () =>
        client.updateDocument(document.id, { title: document.title }, '"1"'),
      ),
    ).resolves.toEqual(document);
    expect(new Headers(calls[0]?.init?.headers).get('If-Match')).toBe('"1"');
    answer = new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'private, no-store' },
    });
    await expect(
      runWithOrganizationContext(context, () => client.deleteDocument(document.id, '"1"')),
    ).resolves.toBeUndefined();
  });

  it('forwards a write precondition and does not repeat failed mutations', async () => {
    answer = Response.json(
      { status: 503, code: 'upstream.unavailable' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.deleteDocument(document.id, '"1"')),
    ).rejects.toMatchObject({ problem: { status: 503 } });
    expect(calls).toHaveLength(1);
    expect(new Headers(calls[0]?.init?.headers).get('If-Match')).toBe('"1"');
  });
});
