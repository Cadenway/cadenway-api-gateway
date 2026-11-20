import { ProblemException } from '@cadenway/nest-common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
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
      .send({ uploadId });
    expect(updated.status).toBe(204);
    expect(updated.headers.etag).toBe('"5"');
    const removed = await request(app.server)
      .delete('/v1/organization/logo')
      .set('Cookie', orgSession)
      .set('Origin', ALLOWED_ORIGIN);
    expect(removed.status).toBe(204);
    expect(removed.headers.etag).toBe('"6"');
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
