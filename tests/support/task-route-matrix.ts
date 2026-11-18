import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import type request from 'supertest';
import { expect } from 'vitest';

import { taskProblem, type TaskServiceMethod } from './fake-task.js';
import { declaredProblemCodes, type SpecMethod } from './public-contract.js';
import type { CaseFakes, RouteCase } from './route-cases.js';

/**
 * A route of task-service as the matrix exercises it.
 */
export interface TaskRoute {
  /** Method of the public operation. */
  readonly method: SpecMethod;
  /** Path of the public operation, as the spec writes it. */
  readonly path: string;
  /** URL of a valid request. */
  readonly url: string;
  /** Call of the technical client the route makes. */
  readonly call: TaskServiceMethod;
  /** Scope a personal API token needs. */
  readonly scope: 'tasks:read' | 'tasks:write';
  /** Success status of the operation. */
  readonly status: number;
  /** Body of a valid request. */
  readonly body?: unknown;
  /** Headers of a valid request. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Arguments the call receives for the valid request. */
  readonly calledWith: readonly unknown[];
  /** A request the public validator refuses with `400 request.invalid`. */
  readonly invalid: {
    readonly url?: string;
    readonly body?: unknown;
    readonly headers?: Readonly<Record<string, string>>;
  };
  /** Further checks of the success answer (headers, body). */
  readonly check?: (response: request.Response, fakes: CaseFakes) => void;
}

/**
 * The members of a problem answer the cases read.
 */
interface ProblemBody {
  // #region Properties
  /** Human text of the problem. */
  readonly detail?: unknown;

  /** Details of the problem. */
  readonly details?: Readonly<Record<string, unknown>>;
  // #endregion
}

/**
 * Codes the guards answer before any call: they are never relayed from task-service.
 */
const GUARD_CODES: ReadonlySet<string> = new Set<string>([
  'auth.scope-missing',
  'auth.api-token-not-accepted',
  'auth.csrf-rejected',
  'organization.not-selected',
  'organization.mfa-required',
]);

/**
 * Statuses whose declared codes task-service may answer and the route relays.
 */
const RELAYED_STATUSES: readonly ProblemStatus[] = [400, 403, 404, 409, 412, 422];

/**
 * Builds the cases of one route: the success with a session and with a token, the guards (no
 * credential, a token without the scope, a session without organization, the rate limit), the
 * validation of the request, every client error the public operation declares relayed with its
 * code, an undeclared one and an unavailable task-service answered as `503`.
 *
 * @param route - The route.
 * @returns Its cases.
 */
export function taskRouteCases(route: TaskRoute): readonly RouteCase[] {
  const label = `${route.method.toUpperCase()} ${route.path}`;
  const base = {
    method: route.method,
    path: route.path,
    url: route.url,
    ...(route.body === undefined ? {} : { body: route.body }),
    ...(route.headers === undefined ? {} : { headers: route.headers }),
  };
  const notCalled = (_response: request.Response, { task }: CaseFakes): void => {
    expect(task[route.call]).not.toHaveBeenCalled();
  };
  const cases: RouteCase[] = [
    {
      ...base,
      name: `${label} answers ${String(route.status)} through task-service for a session`,
      status: route.status,
      check: (response, fakes) => {
        expect(fakes.task[route.call]).toHaveBeenCalledTimes(1);
        expect(fakes.task[route.call]).toHaveBeenCalledWith(...route.calledWith);
        route.check?.(response, fakes);
      },
    },
    route.scope === 'tasks:read'
      ? {
          ...base,
          name: `${label} answers ${String(route.status)} for a token holding tasks:read`,
          credential: 'tasks-token',
          status: route.status,
        }
      : {
          ...base,
          name: `${label} refuses a token holding tasks:read only`,
          credential: 'tasks-token',
          status: 403,
          code: 'auth.scope-missing',
          check: notCalled,
        },
    {
      ...base,
      name: `${label} refuses a session without a current organization`,
      credential: 'session-without-organization',
      status: 403,
      code: 'organization.not-selected',
      check: notCalled,
    },
    {
      ...base,
      name: `${label} requires a credential`,
      credential: 'none',
      status: 401,
      code: 'auth.session-required',
      check: notCalled,
    },
    {
      ...base,
      name: `${label} refuses a request outside its contract before any call`,
      ...(route.invalid.url === undefined ? {} : { url: route.invalid.url }),
      ...(route.invalid.body === undefined ? {} : { body: route.invalid.body }),
      headers: { ...route.headers, ...route.invalid.headers },
      status: 400,
      code: 'request.invalid',
      check: notCalled,
    },
    {
      ...base,
      name: `${label} answers 429 beyond the quota of the session`,
      arrange: ({ counter }) =>
        counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 }),
      status: 429,
      code: 'rate-limit.exceeded',
      check: (response, fakes) => {
        expect(response.headers['retry-after']).toBe('9');
        notCalled(response, fakes);
      },
    },
    {
      ...base,
      name: `${label} answers a client error its operation does not declare as 503 upstream.failed`,
      arrange: ({ task }) =>
        task[route.call].mockRejectedValue(taskProblem(422, 'task.undeclared-rule')),
      status: 503,
      code: 'upstream.failed',
      check: (response) => {
        expect((response.body as ProblemBody).details).toEqual({ service: 'task-service' });
      },
    },
    {
      ...base,
      name: `${label} relays an unavailable task-service`,
      arrange: ({ task }) =>
        task[route.call].mockRejectedValue(
          new ProblemException({
            status: 503,
            code: 'upstream.unavailable',
            details: { service: 'task-service' },
          }),
        ),
      status: 503,
      code: 'upstream.unavailable',
    },
  ];
  for (const status of RELAYED_STATUSES) {
    for (const code of declaredProblemCodes(route.method, route.path, status)) {
      if (GUARD_CODES.has(code)) {
        continue;
      }
      cases.push({
        ...base,
        name: `${label} relays ${String(status)} ${code} of task-service`,
        arrange: ({ task }) => task[route.call].mockRejectedValue(taskProblem(status, code)),
        status,
        code,
        check: (response) => {
          const body = response.body as ProblemBody;
          expect(body.detail).not.toBe('Internal wording that never reaches the browser.');
          expect(body.details?.service).toBeUndefined();
        },
      });
    }
  }
  return cases;
}
