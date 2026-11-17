import { ProblemException } from '@cadenway/nest-common';
import type { Response } from 'express';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { identityProblem, identityUnavailable } from '../../tests/support/fake-identity.js';
import {
  isUpstreamProblem,
  relayUpstream,
  retryAfterSeconds,
  toPublicProblem,
} from './upstream-problem.js';

/**
 * Constant NOW
 *
 * @description
 * Fixed current time of the tests.
 *
 * @type {Date}
 */
const NOW: Date = new Date('2026-11-08T13:07:00Z');

describe('toPublicProblem', () => {
  it('leaves an error that is not a problem unchanged', () => {
    const error: Error = new Error('defect');

    expect(toPublicProblem(error, {})).toBe(error);
  });

  it('leaves a 503 of the internal HTTP client unchanged', () => {
    const error: ProblemException = identityUnavailable('deadline-exceeded');

    expect(toPublicProblem(error, {})).toBe(error);
  });

  it('keeps the members of details other than service, and drops the internal wording', () => {
    const translated: unknown = toPublicProblem(
      identityProblem(422, 'auth.invalid-credentials', { remainingAttempts: 2 }),
      { 422: ['auth.invalid-credentials'] },
    );

    expect(translated).toBeInstanceOf(ProblemException);
    expect((translated as ProblemException).problem).toEqual({
      type: 'about:blank',
      title: 'E-mail ou mot de passe incorrect.',
      status: 422,
      code: 'auth.invalid-credentials',
      details: { remainingAttempts: 2 },
    });
  });

  it('answers an internal 404 the route does not declare as 503 upstream.failed, never 403', () => {
    const translated: unknown = toPublicProblem(identityProblem(404, 'user.not-found'), {});

    expect((translated as ProblemException).problem).toMatchObject({
      status: 503,
      code: 'upstream.failed',
      details: { service: 'identity-service' },
    });
  });

  it('keeps an internal 404 a route declares a 404, with the code alone', () => {
    const translated: unknown = toPublicProblem(identityProblem(404, 'task.not-found'), {
      404: ['task.not-found'],
    });

    expect((translated as ProblemException).problem).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'task.not-found',
    });
  });

  it('answers a missing organization of the internal token as 503 upstream.unauthorized', () => {
    const translated: unknown = toPublicProblem(
      identityProblem(403, 'auth.organization-required'),
      { 403: ['auth.organization-required'] },
    );

    expect((translated as ProblemException).problem).toMatchObject({
      status: 503,
      code: 'upstream.unauthorized',
    });
  });
});

describe('retryAfterSeconds', () => {
  /**
   * Function tooManyRequests
   *
   * @description
   * Builds a `429` problem with the given details.
   *
   * @param {Record<string, unknown>} details - Details of the problem.
   * @returns {ProblemException['problem']} The problem.
   */
  function tooManyRequests(details: Record<string, unknown>): ProblemException['problem'] {
    return new ProblemException({ status: 429, code: 'auth.account-locked', details }).problem;
  }

  it('rounds the seconds left up', () => {
    expect(
      retryAfterSeconds(tooManyRequests({ lockedUntil: '2026-11-08T13:07:00.001Z' }), NOW),
    ).toBe(1);
    expect(retryAfterSeconds(tooManyRequests({ lockedUntil: '2026-11-08T13:22:00Z' }), NOW)).toBe(
      900,
    );
  });

  it('derives the seconds until the allowance of invitation emails grows again', () => {
    expect(
      retryAfterSeconds(
        tooManyRequests({ remaining: 0, nextAvailableAt: '2026-11-08T18:07:00Z' }),
        NOW,
      ),
    ).toBe(18_000);
  });

  it('answers at least one second for an instant already past', () => {
    expect(
      retryAfterSeconds(tooManyRequests({ resendAvailableAt: '2026-11-08T13:00:00Z' }), NOW),
    ).toBe(1);
  });

  it('derives nothing without a valid instant', () => {
    expect(retryAfterSeconds(tooManyRequests({}), NOW)).toBeUndefined();
    expect(retryAfterSeconds(tooManyRequests({ lockedUntil: 'soon' }), NOW)).toBeUndefined();
    expect(retryAfterSeconds(tooManyRequests({ lockedUntil: 900 }), NOW)).toBeUndefined();
  });

  it('derives nothing for another status', () => {
    const problem: ProblemException['problem'] = new ProblemException({
      status: 422,
      code: 'auth.code-invalid',
      details: { lockedUntil: '2026-11-08T13:22:00Z' },
    }).problem;

    expect(retryAfterSeconds(problem, NOW)).toBeUndefined();
  });
});

describe('relayUpstream', () => {
  it('resolves with what the call resolved with, setting no header', async () => {
    const setHeader: Mock = vi.fn();

    await expect(
      relayUpstream({ setHeader } as unknown as Response, {}, () => Promise.resolve(7)),
    ).resolves.toBe(7);
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('answers the public code of an aliased internal code', async () => {
    const setHeader: Mock = vi.fn();

    const refusal: unknown = await relayUpstream(
      { setHeader } as unknown as Response,
      { 404: ['invitation.not-found'] },
      () =>
        Promise.reject(identityProblem(404, 'organization.not-found', {}, 'organization-service')),
      { 'organization.not-found': 'invitation.not-found' },
    ).catch((error: unknown) => error);

    expect(refusal).toBeInstanceOf(ProblemException);
    expect((refusal as ProblemException).problem).toMatchObject({
      status: 404,
      code: 'invitation.not-found',
    });
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('sets Retry-After from the details of a relayed 429', async () => {
    const setHeader: Mock = vi.fn();
    const resendAvailableAt: string = new Date(Date.now() + 60_000).toISOString();

    await relayUpstream(
      { setHeader } as unknown as Response,
      { 429: ['invitation.resend-throttled'] },
      () =>
        Promise.reject(
          identityProblem(
            429,
            'invitation.resend-throttled',
            { resendAvailableAt },
            'organization-service',
          ),
        ),
    ).catch(() => undefined);

    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.stringMatching(/^(?:59|60)$/u));
  });
});

describe('isUpstreamProblem', () => {
  it('recognizes a status and a code', () => {
    const error: ProblemException = identityProblem(404, 'session.not-found');

    expect(isUpstreamProblem(error, 404, 'session.not-found')).toBe(true);
    expect(isUpstreamProblem(error, 404, 'user.not-found')).toBe(false);
    expect(isUpstreamProblem(new Error('x'), 404, 'session.not-found')).toBe(false);
  });
});
