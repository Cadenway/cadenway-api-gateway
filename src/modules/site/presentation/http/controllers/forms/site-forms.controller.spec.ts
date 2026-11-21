import { ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
import {
  SubmitContactFormBody,
  SubscribeToNewsletterBody,
} from '@cadenway/contracts/validators/public/site';
import type { Request } from 'express';
import requestHttp from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest';

import { NotificationServiceClient } from '../../../../../../clients/notification-service.client.js';
import { createFakeIdentity } from '../../../../../../../tests/support/fake-identity.js';
import { WEBSITE_ORIGIN } from '../../../../../../../tests/support/test-environment.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { CountSiteRequest } from '../../../../../rate-limit/public/addresses/count-site-request.js';
import { SubmitSiteForm } from '../../../../application/use-cases/commands/forms/submit-site-form/submit-site-form.use-case.js';
import { SiteFormsController } from './site-forms.controller.js';

const body = {
  email: 'camille@example.com',
  subject: 'login' as const,
  message: 'Une demande de connexion valide.',
};
const key = '806f0650-bdef-4474-a5cf-22b60c810f76';

function request(
  headersDistinct: Request['headersDistinct'],
  contentType = 'application/json',
): Request {
  return {
    headersDistinct,
    query: {},
    is: (type: string) => (type === contentType ? type : false),
  } as unknown as Request;
}

describe('SiteFormsController', () => {
  it('preserves the contact key and passes the validated body unchanged', async () => {
    const contact = vi.fn().mockResolvedValue(undefined);
    const controller = new SiteFormsController(
      new SubmitSiteForm({ contact, newsletter: vi.fn() }),
    );
    await controller.contact(request({ 'idempotency-key': [key] }), body);
    expect(contact).toHaveBeenCalledExactlyOnceWith(body, key);
  });

  it('rejects absent, repeated and malformed contact keys before the upstream call', async () => {
    const contact = vi.fn();
    const controller = new SiteFormsController(
      new SubmitSiteForm({ contact, newsletter: vi.fn() }),
    );
    for (const values of [undefined, [key, key], ['BAD']]) {
      await expect(
        controller.contact(request({ 'idempotency-key': values }), body),
      ).rejects.toMatchObject({
        problem: { status: 400, code: 'request.invalid' },
      });
    }
    expect(contact).not.toHaveBeenCalled();
  });

  it('refuses non-JSON requests and relays a newsletter address without changing it', async () => {
    const newsletter = vi.fn().mockResolvedValue(undefined);
    const controller = new SiteFormsController(
      new SubmitSiteForm({ contact: vi.fn(), newsletter }),
    );
    const subscription = { email: 'Camille@EXAMPLE.com' };
    await expect(
      controller.newsletter(request({}, 'text/plain'), subscription),
    ).rejects.toBeInstanceOf(ProblemException);
    await controller.newsletter(request({}), subscription);
    expect(newsletter).toHaveBeenCalledExactlyOnceWith(subscription);
  });

  it('validates strict shapes and the Unicode code point limit from the generated contract', () => {
    const contact = new ZodValidationPipe(SubmitContactFormBody);
    const newsletter = new ZodValidationPipe(SubscribeToNewsletterBody);
    const meta = { type: 'body' as const };
    expect(contact.transform({ ...body, message: '😀'.repeat(20) }, meta)).toEqual({
      ...body,
      message: '😀'.repeat(20),
    });
    expect(() => contact.transform({ ...body, message: '😀'.repeat(19) }, meta)).toThrow(
      ProblemException,
    );
    expect(() => contact.transform({ ...body, extra: true }, meta)).toThrow(ProblemException);
    expect(() => newsletter.transform({ email: 'test@example.com', extra: true }, meta)).toThrow(
      ProblemException,
    );
  });
});

describe('public site form HTTP pipeline', () => {
  let route: RouteApplication;
  let contact: MockInstance<NotificationServiceClient['submitContactForm']>;
  let newsletter: MockInstance<NotificationServiceClient['subscribeToNewsletter']>;
  let count: MockInstance<CountSiteRequest['execute']>;

  beforeAll(async () => {
    route = await createRouteApplication(createFakeIdentity());
    contact = vi.spyOn(route.app.get(NotificationServiceClient), 'submitContactForm');
    newsletter = vi.spyOn(route.app.get(NotificationServiceClient), 'subscribeToNewsletter');
    count = vi.spyOn(route.app.get(CountSiteRequest), 'execute');
    contact.mockResolvedValue(undefined);
    newsletter.mockResolvedValue(undefined);
    count.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  afterAll(async () => {
    await route.app.close();
  });

  it('accepts both forms without a session and forwards the exact contact retry key', async () => {
    const response = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Authorization', 'Bearer irrelevant')
      .set('Cookie', '__Host-cw_session=unrelated')
      .set('Idempotency-Key', key)
      .send(body);
    expect(response.status).toBe(202);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toBe('');
    expect(contact).toHaveBeenCalledWith(body, key);
    const signup = await requestHttp(route.server)
      .post('/v1/newsletter-subscriptions')
      .send({ email: 'camille@example.com' });
    expect(signup.status).toBe(202);
    expect(signup.headers['cache-control']).toBe('no-store');
    expect(newsletter).toHaveBeenCalledWith({ email: 'camille@example.com' });
  });

  it('applies no-store and sanitizes input, rate limit and upstream failures', async () => {
    const malformed = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', key)
      .send('{"message":"discarded-before-controller');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['cache-control']).toBe('no-store');
    expect(malformed.text).not.toContain('discarded-before-controller');

    const bad = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Idempotency-Key', key)
      .send({ ...body, surprise: 'private-value' });
    expect(bad.status).toBe(400);
    expect(bad.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(bad.body)).not.toContain('private-value');
    const unknownKey = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Idempotency-Key', key)
      .send({ ...body, 'private-field-name': 'private-value' });
    expect(unknownKey.status).toBe(400);
    expect(unknownKey.body).toMatchObject({
      code: 'request.invalid',
      details: { issues: [{ in: 'body', path: '', code: 'unrecognized_keys' }] },
    });
    expect(JSON.stringify(unknownKey.body)).not.toContain('private-field-name');
    expect(JSON.stringify(unknownKey.body)).not.toContain('private-value');

    const invalidEmail = await requestHttp(route.server)
      .post('/v1/newsletter-subscriptions')
      .send({ email: 'private-email' });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body).toMatchObject({
      code: 'request.invalid',
      details: { issues: [{ in: 'body', path: 'email', code: 'invalid_format' }] },
    });
    expect(JSON.stringify(invalidEmail.body)).not.toContain('private-email');

    count.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 15 });
    const limited = await requestHttp(route.server)
      .post('/v1/newsletter-subscriptions')
      .send({ email: 'camille@example.com' });
    expect(limited.status).toBe(429);
    expect(limited.headers['cache-control']).toBe('no-store');
    expect(limited.headers['retry-after']).toBe('15');

    contact.mockRejectedValueOnce(
      new ProblemException({
        status: 422,
        code: 'idempotency.key-reused',
        detail: 'private-value',
      }),
    );
    const refused = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Idempotency-Key', key)
      .send(body);
    expect(refused.status).toBe(422);
    expect(refused.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(refused.body)).not.toContain('private-value');
    expect(route.logLines.join('\n')).not.toContain('private-value');
    expect(route.logLines.join('\n')).not.toContain('private-field-name');
  });

  it.each(['/v1/contact-submissions', '/v1/newsletter-subscriptions'])(
    'applies the configured CORS policy to parser errors on %s',
    async (path) => {
      const normal = await requestHttp(route.server)
        .post(path)
        .set('Origin', WEBSITE_ORIGIN)
        .set('Idempotency-Key', key)
        .send(path === '/v1/contact-submissions' ? body : { email: 'camille@example.com' });
      expect(normal.status).toBe(202);
      expect(normal.headers['access-control-allow-origin']).toBe(WEBSITE_ORIGIN);

      const malformed = await requestHttp(route.server)
        .post(path)
        .set('Origin', WEBSITE_ORIGIN)
        .set('Content-Type', 'application/json')
        .send('{"message":"private-content');
      expect(malformed.status).toBe(400);
      expect(malformed.headers['cache-control']).toBe('no-store');
      expect(malformed.headers['access-control-allow-origin']).toBe(WEBSITE_ORIGIN);
      expect(malformed.headers['access-control-allow-credentials']).toBe(
        normal.headers['access-control-allow-credentials'],
      );
      expect(malformed.headers['access-control-expose-headers']).toBe(
        normal.headers['access-control-expose-headers'],
      );
      expect(malformed.headers['access-control-expose-headers']).toContain('X-Request-Id');
      expect(malformed.headers.vary).toContain('Origin');
      expect(malformed.text).not.toContain('private-content');

      const disallowed = await requestHttp(route.server)
        .post(path)
        .set('Origin', 'https://untrusted.example')
        .set('Content-Type', 'application/json')
        .send('{"message":"private-content');
      expect(disallowed.status).toBe(400);
      expect(disallowed.headers['cache-control']).toBe('no-store');
      expect(disallowed.headers['access-control-allow-origin']).toBeUndefined();
      expect(disallowed.text).not.toContain('private-content');
    },
  );

  it('creates its own exposed request reference for parser errors', async () => {
    const supplied = '7da16211-7009-4083-9ada-1bc39f16f62a';
    const malformed = await requestHttp(route.server)
      .post('/v1/contact-submissions')
      .set('Origin', WEBSITE_ORIGIN)
      .set('X-Request-Id', supplied)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(malformed.headers['x-request-id']).not.toBe(supplied);
    expect(malformed.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });
});
