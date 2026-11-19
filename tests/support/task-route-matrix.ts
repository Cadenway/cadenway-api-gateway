import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import type request from 'supertest';
import { expect } from 'vitest';

import { TASKS_API_TOKEN, TASKS_TOKEN } from './fake-identity.js';
import { taskProblem, type TaskServiceMethod } from './fake-task.js';
import {
  declaredProblemCodes,
  isNode,
  resolveNode,
  specOf,
  type PublicSpec,
  type SpecMethod,
} from './public-contract.js';
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
  /**
   * Codes the public operation declares but its internal operation does not: task-service never
   * answers them there, so the route answers them `503 upstream.failed` like any undeclared client
   * error, and the matrix checks that instead of their relay.
   */
  readonly notRelayed?: readonly string[];
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
 * Blank `If-Match` values a client may send. Node.js strips the spaces and tabs around a header
 * value: the first two reach the gateway as `""` (the second shows that the wire form of spaces
 * and tabs is refused too), and `", "` reaches it as `","`. A no-break space (U+00A0) is kept
 * as it is, and the `trim()` of the owning service would strip it.
 *
 * The no-break space is sent on the routes without a body only (`bodiless`): with a JSON body,
 * the HTTP client of Node.js writes the header block and the body text in one UTF-8 string, so
 * the byte `A0` leaves as `C2 A0` and the gateway reads `"\u00c2\u00a0"`, which is not blank. The
 * raw byte under a body is shown on `PUT /v1/spaces/{spaceId}/grants/{userId}`, and the `", "`
 * Node.js makes of two empty headers on `DELETE /v1/spaces/{spaceId}/grants/{userId}`: a route
 * case sends one text value per header.
 */
const BLANK_IF_MATCH: readonly {
  readonly label: string;
  readonly value: string;
  readonly bodiless?: true;
}[] = [
  { label: 'an empty If-Match', value: '' },
  { label: 'an If-Match of spaces and tabs only', value: ' \t ' },
  { label: 'an If-Match of a no-break space', value: '\u00a0', bodiless: true },
  { label: 'an If-Match of empty list members', value: ', ' },
];

/**
 * A personal API token with `tasks:write`, as its introspection returns it: a bearer request
 * skips the `Content-Type` part of the cross-site check, so the media type of its body reaches
 * the validation of the route.
 */
const TASKS_WRITE_API_TOKEN: typeof TASKS_API_TOKEN = {
  ...TASKS_API_TOKEN,
  scopes: ['tasks:write'],
};

/**
 * The issue of a body sent with a media type other than JSON in UTF-8, as the gateway answers it.
 */
const UNSUPPORTED_MEDIA_TYPE_ISSUE = {
  in: 'body',
  path: '',
  code: 'unsupported_media_type',
  message: 'Expected an application/json body in UTF-8.',
};

/**
 * Tells whether the public operation marks its request body required
 * (`requestBody.required: true`), as the installed spec declares it.
 *
 * @param method - Method of the operation.
 * @param path - Path of the operation, as the spec writes it.
 * @returns Whether a request of the operation must carry a body.
 */
function requiresBody(method: SpecMethod, path: string): boolean {
  const spec: PublicSpec = specOf(path);
  const pointer = `/paths/${path.replaceAll('~', '~0').replaceAll('/', '~1')}/${method}`;
  const operation = resolveNode(spec, pointer).node;
  if (!isNode(operation.requestBody)) {
    return false;
  }
  return resolveNode(spec, `${pointer}/requestBody`).node.required === true;
}

/**
 * Builds the cases of one route: the success with a session and with a token, the guards (no
 * credential, a token without the scope, a session without organization, a session request from
 * another site for a change, the rate limit), the validation of the request (a blank `If-Match`
 * where the route relays one, a zero-byte body where the operation requires a body), every client
 * error the public operation declares relayed with its code (but those of `notRelayed`), an
 * undeclared one and an unavailable task-service answered as `503`.
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
  if (route.method !== 'get') {
    cases.push({
      ...base,
      name: `${label} refuses a session request from another site before any call`,
      origin: 'https://evil.test',
      status: 403,
      code: 'auth.csrf-rejected',
      check: notCalled,
    });
  }
  if (route.headers?.['If-Match'] !== undefined) {
    for (const blank of BLANK_IF_MATCH) {
      if (blank.bodiless === true && route.body !== undefined) {
        continue;
      }
      cases.push({
        ...base,
        name: `${label} refuses ${blank.label} before any call`,
        headers: { ...route.headers, 'If-Match': blank.value },
        status: 400,
        code: 'request.invalid',
        check: (response, fakes) => {
          expect((response.body as ProblemBody).details).toEqual({
            issues: [expect.objectContaining({ in: 'header', path: 'If-Match' })],
          });
          notCalled(response, fakes);
        },
      });
    }
  }
  if (requiresBody(route.method, route.path)) {
    cases.push({
      method: route.method,
      path: route.path,
      url: route.url,
      name: `${label} refuses a zero-byte body before any call`,
      headers: { ...route.headers, 'Content-Type': 'application/json', 'Content-Length': '0' },
      status: 400,
      code: 'request.invalid',
      check: (response, fakes) => {
        expect((response.body as ProblemBody).details).toEqual({
          issues: [{ in: 'body', path: '', code: 'required', message: 'Expected a JSON body.' }],
        });
        notCalled(response, fakes);
      },
    });
    cases.push({
      method: route.method,
      path: route.path,
      url: route.url,
      name: `${label} refuses a form-encoded body of a token holding tasks:write before any call`,
      credential: { bearer: `Bearer ${TASKS_TOKEN}` },
      origin: null,
      arrange: ({ identity }) =>
        identity.introspectApiToken.mockResolvedValue(TASKS_WRITE_API_TOKEN),
      headers: { ...route.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: '&',
      status: 400,
      code: 'request.invalid',
      check: (response, fakes) => {
        expect((response.body as ProblemBody).details).toEqual({
          issues: [UNSUPPORTED_MEDIA_TYPE_ISSUE],
        });
        notCalled(response, fakes);
      },
    });
  }
  for (const status of RELAYED_STATUSES) {
    for (const code of declaredProblemCodes(route.method, route.path, status)) {
      if (GUARD_CODES.has(code)) {
        continue;
      }
      if (route.notRelayed?.includes(code) === true) {
        cases.push({
          ...base,
          name: `${label} answers ${String(status)} ${code}, which its internal operation does not declare, as 503 upstream.failed`,
          arrange: ({ task }) => task[route.call].mockRejectedValue(taskProblem(status, code)),
          status: 503,
          code: 'upstream.failed',
        });
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
