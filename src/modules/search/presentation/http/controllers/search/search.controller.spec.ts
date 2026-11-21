import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SearchServiceClient } from '../../../../../../clients/search-service.client.js';
import {
  CAMILLE_ORGANIZATION_TOKEN,
  MEMBERS_TOKEN,
  createFakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import type { SearchPort } from '../../../../application/ports/outbound/search-service/search/search.port.js';
import { SearchPalette } from '../../../../application/use-cases/queries/search/search-palette/search-palette.use-case.js';
import { searchQueryValidation } from '../../validation/search/search-query.validation.js';
import { SearchController } from './search.controller.js';

describe('Search public route', () => {
  it('validates and projects a private page from the owning service', async () => {
    const search = vi.fn<SearchPort['search']>().mockResolvedValue({
      items: [
        { kind: 'task', taskKey: 'CAD-482', name: 'SSO', status: 'progress', private: 'hidden' },
      ],
      nextCursor: null,
      private: 'hidden',
    });
    const controller = new SearchController(new SearchPalette({ search }));
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;

    const result = await controller.search({ q: 'SSO', limit: 50 }, response);

    expect(result).toEqual({
      items: [{ kind: 'task', taskKey: 'CAD-482', name: 'SSO', status: 'progress' }],
      nextCursor: null,
    });
    expect(search).toHaveBeenCalledWith({ q: 'SSO', limit: 50 });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('preserves a sanitized organization absence', async () => {
    const search = vi
      .fn<SearchPort['search']>()
      .mockRejectedValue(new ProblemException({ status: 404, code: 'organization.not-found' }));
    const controller = new SearchController(new SearchPalette({ search }));
    await expect(
      controller.search({ q: 'SSO', limit: 50 }, { setHeader: vi.fn() } as unknown as Response),
    ).rejects.toMatchObject({ problem: { status: 404, code: 'organization.not-found' } });
  });

  it('rejects duplicates, unknown keys and cursors outside the contract', () => {
    for (const value of [
      { q: ['one', 'two'] },
      { q: 'SSO', limit: ['1'] },
      { q: 'SSO', other: 'value' },
      { q: 'SSO', cursor: '' },
      { q: 'SSO', cursor: 'a'.repeat(1025) },
      { q: 'SSO', limit: '101' },
    ])
      expect(searchQueryValidation.safeParse(value).success).toBe(false);
    expect(searchQueryValidation.parse({ q: 'SSO' })).toEqual({ q: 'SSO', limit: 50 });
  });
});

describe('Search HTTP guards and validation', () => {
  let application: RouteApplication;
  const search = vi.fn().mockResolvedValue({ items: [], nextCursor: null });

  beforeAll(async () => {
    application = await createRouteApplication(createFakeIdentity());
    Object.assign(application.app.get(SearchServiceClient), { search });
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('accepts a verified session and rejects API tokens and repeated parameters', async () => {
    const session = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;
    const allowed = await request(application.server)
      .get('/v1/search?q=SSO')
      .set('Cookie', session);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['cache-control']).toBe('private, no-store');
    expect(search).toHaveBeenCalledWith({ q: 'SSO', limit: 50 });

    const token = await request(application.server)
      .get('/v1/search?q=SSO')
      .set('Authorization', `Bearer ${MEMBERS_TOKEN}`);
    expect(token.status).toBe(403);
    expect(token.body as unknown).toMatchObject({ code: 'auth.api-token-not-accepted' });

    const invalid = await request(application.server)
      .get('/v1/search?q=SSO&limit=1&limit=2')
      .set('Cookie', session);
    expect(invalid.status).toBe(400);
    expect(invalid.headers['cache-control']).toBe('private, no-store');
  });

  it('does not echo unknown keys or repeated query values in validation problems', async () => {
    const session = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;
    const invalidQueries = [
      '/v1/search?q=private-search&private-key=private-value',
      '/v1/search?q=private-first&q=private-second&cursor=private-cursor',
    ];
    for (const query of invalidQueries) {
      const result = await request(application.server).get(query).set('Cookie', session);
      expect(result.status).toBe(400);
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.body as unknown).toMatchObject({
        code: 'request.invalid',
        title: 'Paramètres de recherche invalides.',
      });
      expect(JSON.stringify(result.body)).not.toContain('private-');
    }
  });
});
