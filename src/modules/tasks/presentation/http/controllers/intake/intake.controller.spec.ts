import { ProblemException } from '@cadenway/nest-common';
import type { ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';

import {
  CAMILLE_ORGANIZATION_TOKEN,
  createFakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';
import { CountIntakeRequest } from '../../../../../rate-limit/public/addresses/count-intake-request.js';
import type { IntakeRegistry } from '../../../../application/ports/outbound/task-service/intake/intake-registry.port.js';
import { DisableIntake } from '../../../../application/use-cases/commands/intake/disable-intake/disable-intake.use-case.js';
import { PublishIntake } from '../../../../application/use-cases/commands/intake/publish-intake/publish-intake.use-case.js';
import { SubmitPublicIntake } from '../../../../application/use-cases/commands/intake/submit-public-intake/submit-public-intake.use-case.js';
import { UpdateIntakeConfiguration } from '../../../../application/use-cases/commands/intake/update-intake-configuration/update-intake-configuration.use-case.js';
import { GetIntakeConfiguration } from '../../../../application/use-cases/queries/intake/get-intake-configuration/get-intake-configuration.use-case.js';
import { GetIntakeContact } from '../../../../application/use-cases/queries/intake/get-intake-contact/get-intake-contact.use-case.js';
import { GetPublicIntake } from '../../../../application/use-cases/queries/intake/get-public-intake/get-public-intake.use-case.js';
import {
  IntakeController,
  IntakePublicationKeyGuard,
  PublicIntakeController,
} from './intake.controller.js';

const listId = '019a7001-2b3c-7d4e-8f5a-6b7c8d9e0f12';
const key = 'F3Nq7tG2hu0TQvQqMCuBCgBl2R7dV7jvxrT3SRiYkTQ';

function setup() {
  const configuration = {
    title: 'Request',
    description: null,
    fields: {
      description: 'optional',
      priority: 'optional',
      dueDate: 'optional',
      contactEmail: 'required',
    },
    defaultStatus: 'triage',
    defaultAssigneeId: null,
    publicKey: key,
    version: 2,
  };
  const registry = {
    getConfiguration: vi.fn().mockResolvedValue({ body: configuration, version: 2 }),
    updateConfiguration: vi.fn().mockResolvedValue({ body: configuration, version: 2 }),
    publish: vi.fn().mockResolvedValue({ body: configuration, version: 2 }),
    disable: vi.fn().mockResolvedValue({ version: 2 }),
    contact: vi.fn().mockResolvedValue({ contactEmail: null }),
    getPublic: vi.fn().mockResolvedValue({
      title: configuration.title,
      description: null,
      fields: configuration.fields,
    }),
    submit: vi.fn().mockResolvedValue({ receipt: key }),
  };
  const port: IntakeRegistry = registry;
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as Response;
  return {
    registry,
    response,
    setHeader,
    management: new IntakeController(
      new GetIntakeConfiguration(port),
      new UpdateIntakeConfiguration(port),
      new PublishIntake(port),
      new DisableIntake(port),
      new GetIntakeContact(port),
    ),
    applicant: new PublicIntakeController(new GetPublicIntake(port), new SubmitPublicIntake(port)),
  };
}

describe('intake routes', () => {
  it.each(['short', 'A'.repeat(42) + '+', 'A'.repeat(44)])(
    'refuses malformed publication key without calling task-service',
    (publicKey) => {
      const { registry, setHeader } = setup();
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ params: { publicKey } }),
          getResponse: () => ({ setHeader }),
        }),
      } as unknown as ExecutionContext;
      try {
        new IntakePublicationKeyGuard().canActivate(context);
        throw new Error('The malformed key was accepted.');
      } catch (error) {
        expect(error).toBeInstanceOf(ProblemException);
        expect((error as ProblemException).problem).toMatchObject({
          status: 404,
          code: 'intake-form.not-found',
        });
      }
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(registry.getPublic).not.toHaveBeenCalled();
      expect(registry.submit).not.toHaveBeenCalled();
    },
  );

  it('accepts the published 43-character base64url format', () => {
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ params: { publicKey: key } }) }),
    } as unknown as ExecutionContext;
    expect(new IntakePublicationKeyGuard().canActivate(context)).toBe(true);
  });

  it('accepts the complete base64url alphabet accepted by task-service', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ params: { publicKey: 'A'.repeat(42) + 'B' } }),
      }),
    } as unknown as ExecutionContext;
    expect(new IntakePublicationKeyGuard().canActivate(context)).toBe(true);
  });

  it('returns validated configuration and the current ETag without caching', async () => {
    const { management, response, setHeader } = setup();
    const result = await management.getConfiguration({ listId }, response);
    expect(result.version).toBe(2);
    expect(setHeader).toHaveBeenCalledWith('ETag', '"2"');
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('forwards the version and retains the ETag when disabling', async () => {
    const { management, registry, response, setHeader } = setup();
    await management.disable({ listId }, '"2"', response);
    expect(registry.disable).toHaveBeenCalledWith(listId, '"2"');
    expect(setHeader).toHaveBeenCalledWith('ETag', '"2"');
  });

  it('relays anonymous submissions with the caller key and never returns contact data', async () => {
    const { applicant, registry, response, setHeader } = setup();
    const result = await applicant.submit(
      { publicKey: key },
      { title: 'Hello', contactEmail: 'a@example.com' },
      'once',
      response,
    );
    expect(registry.submit).toHaveBeenCalledWith(
      key,
      { title: 'Hello', contactEmail: 'a@example.com' },
      'once',
    );
    expect(result).toEqual({ receipt: key });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('masks an unexpected failure for a public lookup', async () => {
    const { applicant, registry, response } = setup();
    registry.getPublic.mockRejectedValueOnce(
      new ProblemException({ status: 404, code: 'task.not-found' }),
    );
    await expect(applicant.get({ publicKey: key }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });

  it('removes upstream details from the generic public not-found response', async () => {
    const { applicant, registry, response } = setup();
    const unavailable = (): ProblemException =>
      new ProblemException({
        status: 404,
        code: 'intake-form.not-found',
        details: { hidden: 'private' },
      });
    registry.getPublic.mockRejectedValueOnce(unavailable());
    registry.submit.mockRejectedValueOnce(unavailable());
    for (const call of [
      () => applicant.get({ publicKey: key }, response),
      () => applicant.submit({ publicKey: key }, { title: 'Hello' }, undefined, response),
    ]) {
      try {
        await call();
        throw new Error('The missing form was accepted.');
      } catch (error) {
        expect(error).toBeInstanceOf(ProblemException);
        const problem = (error as ProblemException).problem;
        expect(problem).toMatchObject({ status: 404, code: 'intake-form.not-found' });
        expect(problem.details).toBeUndefined();
      }
    }
  });

  it('rejects an inconsistent task-service ETag', async () => {
    const { management, registry, response } = setup();
    registry.getConfiguration.mockResolvedValueOnce({ body: { version: 2 }, version: 3 });
    await expect(management.getConfiguration({ listId }, response)).rejects.toMatchObject({
      problem: { status: 503, code: 'upstream.failed' },
    });
  });
});

describe('anonymous intake HTTP protections', () => {
  let application: RouteApplication;
  let count: MockInstance<CountIntakeRequest['execute']>;

  beforeAll(async () => {
    application = await createRouteApplication(createFakeIdentity());
  });

  beforeEach(() => {
    count = vi.spyOn(application.app.get(CountIntakeRequest), 'execute').mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('counts and conceals a malformed key before task-service is called', async () => {
    const response = await request(application.server).get('/v1/intake-forms/short');
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ code: 'intake-form.not-found' });
    expect(JSON.stringify(response.body)).not.toContain('short');
    expect(count).toHaveBeenCalledWith(expect.any(String), 'read');
    expect(application.task.getPublicIntakeForm).not.toHaveBeenCalled();
  });

  it('counts and rejects malformed submission keys before body validation', async () => {
    const response = await request(application.server)
      .post('/v1/intake-forms/short/submissions')
      .send({});
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ code: 'intake-form.not-found' });
    expect(JSON.stringify(response.body)).not.toContain('short');
    expect(count).toHaveBeenCalledWith(expect.any(String), 'submit');
    expect(application.task.submitPublicIntakeForm).not.toHaveBeenCalled();
  });

  it('retains no-store for rejected bodies and anonymous rate limits', async () => {
    const invalidBody = await request(application.server)
      .post(`/v1/intake-forms/${key}/submissions`)
      .send({});
    expect(invalidBody.status).toBe(400);
    expect(invalidBody.headers['cache-control']).toBe('no-store');

    count.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 27,
    });
    const limited = await request(application.server).get('/v1/intake-forms/short');
    expect(limited.status).toBe(429);
    expect(limited.headers['cache-control']).toBe('no-store');
    expect(limited.headers['retry-after']).toBe('27');
  });

  it('keeps public submissions text-only before attachment upload routes are available', async () => {
    const path = `/v1/intake-forms/${key}/submissions`;
    const draft = request(application.server)
      .post(path)
      .set('Intake-Draft-Key', 'D'.repeat(43))
      .send({ title: 'Help' });
    const claim = request(application.server)
      .post(path)
      .send({ title: 'Help', attachmentIds: ['019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f15'] });
    for (const response of await Promise.all([draft, claim])) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(application.task.submitPublicIntakeForm).not.toHaveBeenCalled();
  });

  it('defers changes to an intake form attachment policy until uploads are available', async () => {
    const response = await request(application.server)
      .patch(`/v1/lists/${listId}/intake-form`)
      .set('Cookie', `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}`)
      .set('Origin', ALLOWED_ORIGIN)
      .send({ fields: { attachments: 'required' } });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'request.invalid' });
    expect(application.task.updateIntakeFormConfiguration).not.toHaveBeenCalled();
  });

  it('retains no-store for malformed JSON', async () => {
    const response = await request(application.server)
      .post(`/v1/intake-forms/${key}/submissions`)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
