import { ProblemException } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
import { ATELIER_NORD, INES } from '../../../../../../../tests/support/fake-organization.js';
import {
  CAMILLE,
  CAMILLE_ORGANIZATION_TOKEN,
  CAMILLE_TOKEN,
  MEMBERS_TOKEN,
  TASKS_TOKEN,
  createFakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';
import { GetLogo } from '../../../../application/use-cases/queries/profile-media/get-logo/get-logo.use-case.js';
import { GetMemberAvatar } from '../../../../application/use-cases/queries/profile-media/get-member-avatar/get-member-avatar.use-case.js';
import { ProfileMediaController } from './profile-media.controller.js';

const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
const expiresAt = '2026-11-20T12:05:00Z';
const reservation = { uploadId, expiresAt };
const state = { ...reservation, state: 'pending' as const };
const upload = {
  ...reservation,
  method: 'POST' as const,
  url: 'https://files.example.test/upload',
  fields: { key: 'fixture' },
};
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const selfSession = `__Host-cw_session=${CAMILLE_TOKEN}`;
const orgSession = `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`;

describe('profile media HTTP routes', () => {
  let app: RouteApplication;
  const identity = createFakeIdentity();
  const storage = {
    signProfileMediaTransfer: vi.fn().mockResolvedValue(upload),
    prepareProfileMedia: vi.fn().mockResolvedValue({}),
    getAvatarImage: vi.fn().mockResolvedValue(png),
    getOrganizationLogoImage: vi.fn().mockResolvedValue(png),
  };

  beforeAll(async () => {
    identity.reserveAvatarUpload.mockResolvedValue(reservation);
    identity.getAvatarUploadState.mockResolvedValue(state);
    identity.setAvatar.mockResolvedValue({ etag: '"3"' });
    identity.deleteAvatar.mockResolvedValue({ etag: '"4"' });
    identity.getAvatarReference.mockResolvedValue({ assetId: uploadId });
    app = await createRouteApplication(identity);
    Object.assign(app.app.get(StorageServiceClient), storage);
    app.organization.reserveOrganizationLogoUpload.mockResolvedValue(reservation);
    app.organization.getOrganizationLogoUploadState.mockResolvedValue(state);
    app.organization.setOrganizationLogo.mockResolvedValue({ etag: '"5"' });
    app.organization.deleteOrganizationLogo.mockResolvedValue({ etag: '"6"' });
    app.organization.getOrganization.mockResolvedValue({ ...ATELIER_NORD, logoId: uploadId });
    app.organization.getMember.mockResolvedValue(INES);
  });

  afterAll(async () => app.app.close());

  it('reserves, reads, publishes and removes an account avatar without an organization', async () => {
    const started = await request(app.server)
      .post('/v1/me/avatar/uploads')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Idempotency-Key', 'avatar-key')
      .send({ contentType: 'image/png', sizeBytes: 100 });
    expect(started.status).toBe(201);
    expect(started.headers.location).toBe(`/v1/me/avatar/uploads/${uploadId}`);
    expect(started.headers['cache-control']).toBe('no-store');
    expect(identity.reserveAvatarUpload).toHaveBeenCalledWith(
      CAMILLE.id,
      { contentType: 'image/png', sizeBytes: 100 },
      'avatar-key',
    );
    expect(storage.signProfileMediaTransfer).toHaveBeenCalledWith(
      uploadId,
      { kind: 'avatar', expiresAt, contentType: 'image/png', sizeBytes: 100 },
      'account',
    );

    const image = await request(app.server)
      .get('/v1/me/avatar')
      .set('Cookie', selfSession)
      .set('If-None-Match', '*');
    expect(image.status).toBe(200);
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(image.body as Buffer).toEqual(png);

    const updated = await request(app.server)
      .put('/v1/me/avatar')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '"2"')
      .send({ uploadId });
    expect(updated.status).toBe(204);
    expect(updated.headers.etag).toBe('"3"');
    expect(storage.prepareProfileMedia).toHaveBeenCalledWith(
      uploadId,
      { kind: 'avatar' },
      'account',
    );
    const removed = await request(app.server)
      .delete('/v1/me/avatar')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '"3"');
    expect(removed.status).toBe(204);
    expect(removed.headers.etag).toBe('"4"');
  });

  it('coordinates the logo with the current organization', async () => {
    const started = await request(app.server)
      .post('/v1/organization/logo/uploads')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ contentType: 'image/svg+xml', sizeBytes: 100 });
    expect(started.status).toBe(201);
    expect(started.headers.location).toBe(`/v1/organization/logo/uploads/${uploadId}`);
    expect(storage.signProfileMediaTransfer).toHaveBeenCalledWith(
      uploadId,
      { kind: 'organization-logo', expiresAt, contentType: 'image/svg+xml', sizeBytes: 100 },
      'organization',
    );
    const image = await request(app.server)
      .get('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('If-None-Match', '*');
    expect(image.status).toBe(200);
    expect(image.body as Buffer).toEqual(png);
    const updated = await request(app.server)
      .put('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Organization-Match', ATELIER_NORD.id)
      .set('If-Match', '"4"')
      .send({ uploadId });
    expect(updated.status).toBe(204);
    expect(updated.headers.etag).toBe('"5"');
    expect(app.organization.setOrganizationLogo).toHaveBeenCalledWith(uploadId, '"4"');
    const removed = await request(app.server)
      .delete('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN);
    expect(removed.status).toBe(204);
    expect(removed.headers.etag).toBe('"6"');
  });

  it('refuses stale organization context on every logo write before Organization or Storage', async () => {
    const staleOrganization = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99';
    const organizationAndStorageCalls = [
      app.organization.reserveOrganizationLogoUpload,
      app.organization.getOrganizationLogoUploadState,
      app.organization.setOrganizationLogo,
      app.organization.deleteOrganizationLogo,
      storage.signProfileMediaTransfer,
      storage.prepareProfileMedia,
    ];
    const before = organizationAndStorageCalls.map((mock) => mock.mock.calls.length);

    const started = await request(app.server)
      .post('/v1/organization/logo/uploads')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Organization-Match', staleOrganization)
      .send({ contentType: 'image/svg+xml', sizeBytes: 100 });
    const updated = await request(app.server)
      .put('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Organization-Match', staleOrganization)
      .set('If-Match', '"4"')
      .send({ uploadId });
    const removed = await request(app.server)
      .delete('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Organization-Match', staleOrganization)
      .set('If-Match', '"5"');

    for (const response of [started, updated, removed]) {
      expect(response.status).toBe(412);
      expect(response.body as unknown).toMatchObject({ code: 'organization.context-changed' });
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers.etag).toBeUndefined();
    }
    expect(organizationAndStorageCalls.map((mock) => mock.mock.calls.length)).toEqual(before);
  });

  it('checks the live member and current avatar before reading private bytes', async () => {
    const result = await request(app.server)
      .get(`/v1/members/${INES.id}/avatar`)
      .set('Authorization', `Bearer ${MEMBERS_TOKEN}`);
    expect(result.status).toBe(200);
    expect(app.organization.getMember).toHaveBeenCalledWith(INES.id);
    expect(identity.getAvatarReference).toHaveBeenCalledWith(INES.userId);
    expect(storage.getAvatarImage).toHaveBeenCalledWith(uploadId, INES.userId, 'organization');
  });

  it('rejects stale organization reads before preparing avatar or logo bytes', async () => {
    const originalAvatar: unknown = Object.getOwnPropertyDescriptor(
      ProfileMediaController.prototype,
      'getMemberAvatar',
    )?.value;
    const originalLogo: unknown = Object.getOwnPropertyDescriptor(
      ProfileMediaController.prototype,
      'getLogo',
    )?.value;
    if (typeof originalAvatar !== 'function' || typeof originalLogo !== 'function') {
      throw new Error('Profile media handlers are missing.');
    }
    const avatarHandler = vi.spyOn(ProfileMediaController.prototype, 'getMemberAvatar');
    const logoHandler = vi.spyOn(ProfileMediaController.prototype, 'getLogo');
    for (const [original, handler] of [
      [originalAvatar, avatarHandler],
      [originalLogo, logoHandler],
    ] as const) {
      for (const key of Reflect.getMetadataKeys(original) as unknown[]) {
        Reflect.defineMetadata(key, Reflect.getMetadata(key, original), handler);
      }
    }
    const testIdentity = createFakeIdentity();
    const testApp = await createRouteApplication(testIdentity);
    try {
      const avatar = vi.spyOn(testApp.app.get(GetMemberAvatar), 'execute');
      const logo = vi.spyOn(testApp.app.get(GetLogo), 'execute');
      const avatarBytes = vi.spyOn(testApp.app.get(StorageServiceClient), 'getAvatarImage');
      const logoBytes = vi.spyOn(testApp.app.get(StorageServiceClient), 'getOrganizationLogoImage');
      const calls = [
        testApp.organization.getMember,
        testApp.organization.getOrganization,
        testIdentity.getAvatarReference,
      ];
      const before = calls.map((mock) => mock.mock.calls.length);
      const stale = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99';
      const memberResponse = await request(testApp.server)
        .get(`/v1/members/${INES.id}/avatar`)
        .set('Cookie', orgSession)
        .set('If-Organization-Match', stale);
      const logoResponse = await request(testApp.server)
        .get('/v1/organization/logo')
        .set('Cookie', orgSession)
        .set('If-Organization-Match', stale);

      expectPublicResponse('get', '/v1/members/{memberId}/avatar', memberResponse);
      expectPublicResponse('get', '/v1/organization/logo', logoResponse);
      for (const response of [memberResponse, logoResponse]) {
        expect(response.status).toBe(412);
        expect(response.body as unknown).toMatchObject({ code: 'organization.context-changed' });
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.headers['content-type']).toContain('application/problem+json');
      }
      expect(avatar).not.toHaveBeenCalled();
      expect(logo).not.toHaveBeenCalled();
      expect(avatarHandler).not.toHaveBeenCalled();
      expect(logoHandler).not.toHaveBeenCalled();
      expect(avatarBytes).not.toHaveBeenCalled();
      expect(logoBytes).not.toHaveBeenCalled();
      expect(calls.map((mock) => mock.mock.calls.length)).toEqual(before);
    } finally {
      await testApp.app.close();
      avatarHandler.mockRestore();
      logoHandler.mockRestore();
    }
  });

  it('refuses malformed conditional headers before mutating an image', async () => {
    const previous = identity.setAvatar.mock.calls.length;
    const result = await request(app.server)
      .put('/v1/me/avatar')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('If-Match', '*')
      .send({ uploadId });
    expect(result.status).toBe(400);
    expect(identity.setAvatar).toHaveBeenCalledTimes(previous);
  });

  it('applies private cache headers to early credential and scope errors', async () => {
    const anonymous = await request(app.server).get('/v1/me/avatar');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toBe('private, no-store');
    const scoped = await request(app.server)
      .get(`/v1/members/${INES.id}/avatar`)
      .set('Authorization', `Bearer ${TASKS_TOKEN}`);
    expect(scoped.status).toBe(403);
    expect(scoped.headers['cache-control']).toBe('private, no-store');
  });

  it('prevents caching when a media write has no session', async () => {
    const result = await request(app.server)
      .post('/v1/me/avatar/uploads')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ contentType: 'image/png', sizeBytes: 100 });
    expect(result.status).toBe(401);
    expect(result.headers['cache-control']).toBe('private, no-store');
  });

  it('normalizes malformed media JSON without exposing the supplied text', async () => {
    const invalidBody = '{"contentType":"private-fixture"';
    const result = await request(app.server)
      .post('/v1/me/avatar/uploads')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(invalidBody);
    expect(result.status).toBe(400);
    expect(result.body as unknown).toMatchObject({
      code: 'request.invalid',
      details: { issues: [expect.objectContaining({ in: 'body', path: '' })] },
    });
    expect(result.text).not.toContain('private-fixture');
    expect(result.headers['cache-control']).toBe('private, no-store');
  });

  it('normalizes a malformed member URI without echoing the path', async () => {
    const result = await request(app.server)
      .get('/v1/members/private-fixture%ZZ/avatar')
      .set('Cookie', orgSession);
    expect(result.status).toBe(400);
    expect(result.body as unknown).toMatchObject({
      code: 'request.invalid',
      details: { issues: [expect.objectContaining({ in: 'path', path: 'memberId' })] },
    });
    expect(result.text).not.toContain('private-fixture');
    expect(result.headers['cache-control']).toBe('private, no-store');
  });

  it('prevents caching of owner refusal, rate limiting and service errors', async () => {
    identity.reserveAvatarUpload.mockRejectedValueOnce(
      new ProblemException({ status: 422, code: 'media.unsupported-type' }),
    );
    const refused = await request(app.server)
      .post('/v1/me/avatar/uploads')
      .set('Cookie', selfSession)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ contentType: 'image/gif', sizeBytes: 100 });
    expect(refused.status).toBe(422);
    expect(refused.body as unknown).toMatchObject({ code: 'media.unsupported-type' });
    expect(refused.headers['cache-control']).toBe('private, no-store');

    app.counter.consume.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 7 });
    const limited = await request(app.server).get('/v1/me/avatar').set('Cookie', selfSession);
    expect(limited.status).toBe(429);
    expect(limited.headers['cache-control']).toBe('private, no-store');

    storage.getAvatarImage.mockRejectedValueOnce(
      new ProblemException({ status: 503, code: 'upstream.failed' }),
    );
    const unavailable = await request(app.server).get('/v1/me/avatar').set('Cookie', selfSession);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers['cache-control']).toBe('private, no-store');
  });

  it('relays owner denial before Storage and conceals member account removal', async () => {
    const previous = storage.signProfileMediaTransfer.mock.calls.length;
    app.organization.reserveOrganizationLogoUpload.mockRejectedValueOnce(
      new ProblemException({ status: 403, code: 'organization.role-forbidden' }),
    );
    const denied = await request(app.server)
      .post('/v1/organization/logo/uploads')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ contentType: 'image/svg+xml', sizeBytes: 100 });
    expect(denied.status).toBe(403);
    expect(storage.signProfileMediaTransfer).toHaveBeenCalledTimes(previous);
    identity.getAvatarReference.mockRejectedValueOnce(
      new ProblemException({ status: 404, code: 'user.not-found' }),
    );
    const missing = await request(app.server)
      .get(`/v1/members/${INES.id}/avatar`)
      .set('Cookie', orgSession);
    expect(missing.status).toBe(404);
    expect(missing.body as unknown).toMatchObject({ code: 'media.not-found' });
    expect(missing.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects an unrelated organization or membership before reading Storage', async () => {
    const logoCalls = storage.getOrganizationLogoImage.mock.calls.length;
    app.organization.getOrganization.mockResolvedValueOnce({
      ...ATELIER_NORD,
      id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b99',
      logoId: uploadId,
    });
    const logo = await request(app.server).get('/v1/organization/logo').set('Cookie', orgSession);
    expect(logo.status).toBe(503);
    expect(storage.getOrganizationLogoImage).toHaveBeenCalledTimes(logoCalls);
    const avatarCalls = storage.getAvatarImage.mock.calls.length;
    app.organization.getMember.mockResolvedValueOnce({
      ...INES,
      id: '019a5f3d-1a2b-7c3d-8e4f-5a6b7c8d9e42',
    });
    const avatar = await request(app.server)
      .get(`/v1/members/${INES.id}/avatar`)
      .set('Cookie', orgSession);
    expect(avatar.status).toBe(503);
    expect(storage.getAvatarImage).toHaveBeenCalledTimes(avatarCalls);
  });
});
