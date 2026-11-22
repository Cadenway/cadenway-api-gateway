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

import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import { createFakeIdentity } from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import { ALLOWED_ORIGIN } from '../../../../../../../tests/support/test-environment.js';
import { CountIntakeRequest } from '../../../../../rate-limit/public/addresses/count-intake-request.js';
import type { IntakeAttachments } from '../../../../application/ports/outbound/storage-service/intake/intake-attachments.port.js';
import { expectPublicResponse } from '../../../../../../../tests/support/public-contract.js';
import type { IntakeRegistry } from '../../../../application/ports/outbound/task-service/intake/intake-registry.port.js';
import { CompleteIntakeAttachment } from '../../../../application/use-cases/commands/intake/complete-intake-attachment/complete-intake-attachment.use-case.js';
import { DisableIntake } from '../../../../application/use-cases/commands/intake/disable-intake/disable-intake.use-case.js';
import { PublishIntake } from '../../../../application/use-cases/commands/intake/publish-intake/publish-intake.use-case.js';
import { ReleaseIntakeAttachment } from '../../../../application/use-cases/commands/intake/release-intake-attachment/release-intake-attachment.use-case.js';
import { StartIntakeAttachment } from '../../../../application/use-cases/commands/intake/start-intake-attachment/start-intake-attachment.use-case.js';
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
const draftKey = 'A'.repeat(43);
const attachmentId = '019a7004-3b2c-7d4e-8f5a-6b7c8d9e0f15';
const organizationId = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';
const proof = {
  attachmentId,
  organizationId,
  publicationId: '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b02',
  expiresAt: '2026-11-20T14:30:00Z',
};
const declaration = { fileName: 'capture.png', contentType: 'image/png', sizeBytes: 100 };
const capability = {
  id: attachmentId,
  method: 'POST' as const,
  url: 'https://files.example.test/intake',
  fields: { signature: 'fixture-intake-signature' },
  expiresAt: '2026-11-20T14:05:00Z',
};

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
  const attachments: IntakeAttachments = {
    allocate: vi.fn(),
    resolve: vi.fn(),
    release: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
  };
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
    applicant: new PublicIntakeController(
      new GetPublicIntake(port),
      new SubmitPublicIntake(port),
      new StartIntakeAttachment(attachments),
      new CompleteIntakeAttachment(attachments),
      new ReleaseIntakeAttachment(attachments),
    ),
  };
}

describe('intake routes', () => {
  it.each(['short', 'A'.repeat(42) + '+', 'A'.repeat(44), `${key}\n`])(
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
      undefined,
      response,
    );
    expect(registry.submit).toHaveBeenCalledWith(
      key,
      { title: 'Hello', contactEmail: 'a@example.com' },
      'once',
      undefined,
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
      () =>
        applicant.submit({ publicKey: key }, { title: 'Hello' }, undefined, undefined, response),
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
  let startStorage: MockInstance<StorageServiceClient['startIntakeAttachmentUpload']>;
  let completeStorage: MockInstance<StorageServiceClient['completeIntakeAttachmentUpload']>;

  beforeAll(async () => {
    application = await createRouteApplication(createFakeIdentity());
  });

  beforeEach(() => {
    vi.clearAllMocks();
    count = vi.spyOn(application.app.get(CountIntakeRequest), 'execute').mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    const storage = application.app.get(StorageServiceClient);
    startStorage = vi.spyOn(storage, 'startIntakeAttachmentUpload').mockResolvedValue(capability);
    completeStorage = vi
      .spyOn(storage, 'completeIntakeAttachmentUpload')
      .mockResolvedValue({ id: attachmentId });
    application.task.allocateIntakeAttachment.mockResolvedValue(proof);
    application.task.resolveIntakeAttachment.mockResolvedValue(proof);
    application.task.releaseIntakeAttachment.mockResolvedValue(undefined);
    application.task.submitPublicIntakeForm.mockResolvedValue({ receipt: key });
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

  it('retains no-store for malformed JSON', async () => {
    const response = await request(application.server)
      .post(`/v1/intake-forms/${key}/submissions`)
      .set('Content-Type', 'application/json')
      .send('{');
    expect(response.status).toBe(400);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('uses only the Task binding to sign and verify, and releases through Task alone', async () => {
    const path = `/v1/intake-forms/${key}/attachments`;
    const started = await request(application.server)
      .post(path)
      .set('Intake-Draft-Key', draftKey)
      .set('Idempotency-Key', 'fixture-once')
      .send(declaration);
    expect(started.status).toBe(201);
    expect(started.headers.location).toBe(`attachments/${attachmentId}`);
    expect(started.headers['cache-control']).toBe('no-store');
    expect(started.body).toEqual(capability);
    expect(application.task.allocateIntakeAttachment).toHaveBeenCalledWith(
      key,
      declaration,
      draftKey,
      'fixture-once',
    );
    expect(startStorage).toHaveBeenCalledWith(proof, declaration);
    expect(application.task.allocateIntakeAttachment).toHaveBeenCalledBefore(startStorage);

    const target = `${path}/${attachmentId}`;
    const completion = await request(application.server)
      .post(`${target}/completion`)
      .set('Intake-Draft-Key', draftKey);
    expect(completion.status).toBe(200);
    expect(completion.headers['cache-control']).toBe('no-store');
    expect(completion.body).toEqual({ id: attachmentId });
    expect(application.task.resolveIntakeAttachment).toHaveBeenCalledWith(
      key,
      attachmentId,
      draftKey,
    );
    expect(completeStorage).toHaveBeenCalledWith(proof);
    expect(application.task.resolveIntakeAttachment).toHaveBeenCalledBefore(completeStorage);

    const released = await request(application.server)
      .delete(target)
      .set('Intake-Draft-Key', draftKey);
    expect(released.status).toBe(204);
    expect(released.headers['cache-control']).toBe('no-store');
    expect(released.text).toBe('');
    expect(application.task.releaseIntakeAttachment).toHaveBeenCalledWith(
      key,
      attachmentId,
      draftKey,
    );
    expect(startStorage).toHaveBeenCalledOnce();
    expect(completeStorage).toHaveBeenCalledOnce();
    expect(count.mock.calls.map(([, operation]) => operation)).toEqual(Array(3).fill('attachment'));
    const logs = application.logLines.join('\n');
    for (const secret of [key, draftKey, capability.fields.signature]) {
      expect(logs).not.toContain(secret);
    }
  });

  it('relays an upload start quota refusal without exposing usage or a signed capability', async () => {
    startStorage.mockRejectedValueOnce(
      new ProblemException({
        status: 409,
        code: 'attachment.storage-quota-exceeded',
        details: { used: 123, limit: 456, plan: 'free' },
      }),
    );
    const response = await request(application.server)
      .post(`/v1/intake-forms/${key}/attachments`)
      .set('Intake-Draft-Key', draftKey)
      .set('Idempotency-Key', 'fixture-quota')
      .send(declaration);

    expectPublicResponse('post', '/v1/intake-forms/{publicKey}/attachments', response);
    expect(response.status).toBe(409);
    expect(response.body as unknown).toMatchObject({ code: 'attachment.storage-quota-exceeded' });
    expect(response.body as unknown).not.toHaveProperty('details');
    expect(response.headers.location).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('relays the storage quota refusal without exposing usage to the applicant', async () => {
    completeStorage.mockRejectedValueOnce(
      new ProblemException({
        status: 409,
        code: 'attachment.storage-quota-exceeded',
        details: { used: 123, limit: 456, plan: 'free' },
      }),
    );
    const response = await request(application.server)
      .post(`/v1/intake-forms/${key}/attachments/${attachmentId}/completion`)
      .set('Intake-Draft-Key', draftKey);
    expectPublicResponse(
      'post',
      '/v1/intake-forms/{publicKey}/attachments/{attachmentId}/completion',
      response,
    );
    expect(response.status).toBe(409);
    expect(response.body as unknown).toMatchObject({ code: 'attachment.storage-quota-exceeded' });
    expect(JSON.stringify(response.body)).not.toContain('used');
    expect(JSON.stringify(response.body)).not.toContain('limit');
    expect(JSON.stringify(response.body)).not.toContain('free');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('passes the applicant draft key and attachment IDs only to Task for submission', async () => {
    const body = { title: 'Hello', attachmentIds: [attachmentId] };
    const response = await request(application.server)
      .post(`/v1/intake-forms/${key}/submissions`)
      .set('Intake-Draft-Key', draftKey)
      .set('Idempotency-Key', 'submit-once')
      .send(body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ receipt: key });
    expect(application.task.submitPublicIntakeForm).toHaveBeenCalledWith(
      key,
      body,
      'submit-once',
      draftKey,
    );
    expect(startStorage).not.toHaveBeenCalled();
    expect(completeStorage).not.toHaveBeenCalled();
    expect(count).toHaveBeenCalledWith(expect.any(String), 'submit');
  });

  it('rejects missing or repeated attachment headers without contacting Task or Storage', async () => {
    const base = `/v1/intake-forms/${key}`;
    const missingDraft = await request(application.server)
      .post(`${base}/submissions`)
      .set('Idempotency-Key', 'submit-once')
      .send({ title: 'Hello', attachmentIds: [attachmentId] });
    const missingKey = await request(application.server)
      .post(`${base}/submissions`)
      .set('Intake-Draft-Key', draftKey)
      .send({ title: 'Hello' });
    const repeated = await request(application.server)
      .post(`${base}/attachments`)
      .set('Intake-Draft-Key', draftKey)
      .set({ 'Idempotency-Key': ['one', 'two'] })
      .send(declaration);
    for (const response of [missingDraft, missingKey, repeated]) {
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'request.invalid' });
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(application.task.allocateIntakeAttachment).not.toHaveBeenCalled();
    expect(application.task.submitPublicIntakeForm).not.toHaveBeenCalled();
    expect(startStorage).not.toHaveBeenCalled();
  });

  it('keeps Task and Storage misses indistinguishable and never verifies without current authorization', async () => {
    const completionPath = `/v1/intake-forms/${key}/attachments/${attachmentId}/completion`;
    application.task.resolveIntakeAttachment.mockRejectedValueOnce(
      new ProblemException({
        status: 404,
        code: 'intake-form.not-found',
        details: { hidden: proof.publicationId },
      }),
    );
    const taskMissing = await request(application.server)
      .post(completionPath)
      .set('Intake-Draft-Key', draftKey);
    expect(completeStorage).not.toHaveBeenCalled();
    completeStorage.mockRejectedValueOnce(
      new ProblemException({
        status: 404,
        code: 'attachment.not-found',
        details: { hidden: proof.publicationId },
      }),
    );
    const storageMissing = await request(application.server)
      .post(completionPath)
      .set('Intake-Draft-Key', draftKey);
    for (const response of [taskMissing, storageMissing]) {
      expect(response.status).toBe(404);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({ code: 'intake-form.not-found' });
      expect(response.body).not.toHaveProperty('details');
      expect(JSON.stringify(response.body)).not.toContain(proof.publicationId);
    }
  });

  it('keeps attachment parser and quota errors private, and allows the draft header in browser preflight', async () => {
    const path = `/v1/intake-forms/${key}/attachments`;
    const malformed = await request(application.server)
      .post(path)
      .set('Content-Type', 'application/json')
      .set('Intake-Draft-Key', draftKey)
      .send('{');
    expect(malformed.status).toBe(400);
    expect(malformed.headers['cache-control']).toBe('no-store');
    count.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 25 });
    const refused = await request(application.server).post(path).send(declaration);
    expect(refused.status).toBe(429);
    expect(refused.headers['cache-control']).toBe('no-store');
    expect(refused.headers['retry-after']).toBe('25');
    expect(application.task.allocateIntakeAttachment).not.toHaveBeenCalled();
    const preflight = await request(application.server)
      .options(path)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,intake-draft-key,idempotency-key');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-headers']).toContain('Intake-Draft-Key');
  });
});
