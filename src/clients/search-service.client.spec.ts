import {
  InternalHttpClient,
  InternalTokenSigner,
  runWithOrganizationContext,
} from '@cadenway/nest-common';
import type { Ed25519PrivateJwk, OrganizationContext } from '@cadenway/nest-common';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ATELIER_NORD_ID, CAMILLE } from '../../tests/support/fake-identity.js';
import { GATEWAY_ISSUER, generateSigningKeys } from '../../tests/support/test-environment.js';
import { SEARCH_SERVICE, SearchServiceClient } from './search-service.client.js';

const context: OrganizationContext = {
  organizationId: ATELIER_NORD_ID,
  actor: { type: 'user', id: CAMILLE.id },
  role: 'owner',
  scopes: [],
};
const headers = { 'Cache-Control': 'private, no-store' };
const task = { kind: 'task', taskKey: 'CAD-482', name: 'SSO', status: 'progress' };

describe('SearchServiceClient', () => {
  let signer: InternalTokenSigner;
  let answer: Response;
  let calls: { url: string; init?: RequestInit }[];
  let client: SearchServiceClient;

  beforeAll(async () => {
    const keys = generateSigningKeys();
    signer = await InternalTokenSigner.create({
      issuer: GATEWAY_ISSUER,
      privateJwk: JSON.parse(keys.privateJwk) as Ed25519PrivateJwk,
    });
  });

  beforeEach(() => {
    calls = [];
    answer = Response.json({ items: [task], nextCursor: null }, { headers });
    client = new SearchServiceClient(
      new InternalHttpClient({
        service: SEARCH_SERVICE,
        baseUrl: 'http://search-service.test',
        signer,
        allowedUnavailableProblemCodes: ['search.unavailable'],
        fetch: (input, init) => {
          calls.push({ url: input instanceof Request ? input.url : input.toString(), init });
          return Promise.resolve(answer);
        },
      }),
    );
  });

  it('forwards the verified user context through a signed search request', async () => {
    const page = await runWithOrganizationContext(context, () => client.search({ q: 'SSO' }));

    expect(page).toEqual({ items: [task], nextCursor: null });
    expect(calls[0]?.url).toContain('/internal/v1/search?q=SSO');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toMatch(/^Bearer /u);
  });

  it('strips undeclared result fields and rejects malformed or duplicate pages', async () => {
    answer = Response.json(
      { items: [{ ...task, secret: 'hidden' }], nextCursor: null },
      { headers },
    );
    const page = await runWithOrganizationContext(context, () => client.search({ q: 'SSO' }));
    expect(page.items[0]).not.toHaveProperty('secret');

    answer = Response.json({ items: [task, task], nextCursor: null }, { headers });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('requires private uncacheable JSON and bounds the response stream', async () => {
    answer = Response.json({ items: [task], nextCursor: null });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });

    answer = new Response('x'.repeat(256 * 1024 + 1), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('accepts transparently decoded gzip while bounding the decoded bytes', async () => {
    const encodedHeaders = {
      ...headers,
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      'Content-Length': '25',
    };
    answer = new Response(JSON.stringify({ items: [task], nextCursor: null }), {
      headers: encodedHeaders,
    });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).resolves.toEqual({ items: [task], nextCursor: null });

    answer = new Response('x'.repeat(256 * 1024 + 1), { headers: encodedHeaders });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
  });

  it('accepts a full ordered page and rejects invalid ordering and incomplete continuations', async () => {
    const list = { kind: 'list', listId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e01', name: 'SSO' };
    answer = Response.json({ items: [task, list], nextCursor: 'next' }, { headers });
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO', limit: 2 })),
    ).resolves.toMatchObject({ nextCursor: 'next' });

    for (const body of [
      { items: [list, task], nextCursor: null },
      { items: [{ ...task, taskKey: 'CAD-483' }, task], nextCursor: null },
      {
        items: [{ ...list, listId: '019a7000-1a2b-7c3d-8e4f-5a6b7c8d9e02' }, list],
        nextCursor: null,
      },
      { items: [task], nextCursor: 'next' },
      { items: [], nextCursor: 'next' },
    ]) {
      answer = Response.json(body, { headers });
      await expect(
        runWithOrganizationContext(context, () => client.search({ q: 'SSO', limit: 2 })),
      ).rejects.toMatchObject({ problem: { status: 503, code: 'upstream.failed' } });
    }
  });

  it('preserves a current-organization absence for the route to translate', async () => {
    answer = Response.json(
      { type: 'about:blank', title: 'Not found', status: 404, code: 'organization.not-found' },
      { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
    );
    await expect(
      runWithOrganizationContext(context, () => client.search({ q: 'SSO' })),
    ).rejects.toMatchObject({
      problem: { status: 404, code: 'organization.not-found' },
    });
  });
});
