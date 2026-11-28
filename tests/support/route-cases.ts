import request from 'supertest';
import { expect } from 'vitest';

import {
  CAMILLE_ORGANIZATION_TOKEN,
  CAMILLE_TOKEN,
  MEMBERS_TOKEN,
  TASKS_TOKEN,
  type FakeIdentity,
} from './fake-identity.js';
import type { FakeOrganization } from './fake-organization.js';
import type { FakeTask } from './fake-task.js';
import { declaredStatuses, expectPublicResponse, type SpecMethod } from './public-contract.js';
import type { FakeCounter, RouteApplication } from './route-application.js';
import { ALLOWED_ORIGIN } from './test-environment.js';

/**
 * The credential a route case sends: a session cookie in Atelier Nord, one without a current
 * organization, a personal API token with `members:read` or `tasks:read` only, none, or raw
 * values.
 */
export type CaseCredential =
  | 'session'
  | 'session-without-organization'
  | 'members-token'
  | 'tasks-token'
  | 'none'
  | { readonly cookie?: string; readonly bearer?: string };

/**
 * The fakes a route case arranges.
 */
export interface CaseFakes {
  /** The fake of identity-service. */
  readonly identity: FakeIdentity;
  /** The fake of organization-service. */
  readonly organization: FakeOrganization;
  /** The fake of task-service. */
  readonly task: FakeTask;
  /** The fake of the counters of the sessions and personal API tokens. */
  readonly counter: FakeCounter;
  /** The fake of the counters of the requests without a credential, per client address. */
  readonly anonymousCounter: FakeCounter;
  /** The fake of the counters of the failed bearer-token authentications, per client address. */
  readonly bearerFailureCounter: FakeCounter;
}

/**
 * One request to a public route and the answer the contract expects of it.
 */
export interface RouteCase {
  /** What the case shows. */
  readonly name: string;
  /** Method of the route. */
  readonly method: SpecMethod;
  /** Path of the route, as the spec writes it. */
  readonly path: string;
  /** URL of the request. */
  readonly url: string;
  /** The credential; the session in Atelier Nord by default. */
  readonly credential?: CaseCredential;
  /** JSON body, sent with `Content-Type: application/json`. */
  readonly body?: unknown;
  /** `Origin` of the request; the web application for an unsafe method by default, none with `null`. */
  readonly origin?: string | null;
  /** Other request headers. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Gives the fakes their answers. */
  readonly arrange?: (fakes: CaseFakes) => void;
  /** Expected status. */
  readonly status: number;
  /** Expected `code` of a problem. */
  readonly code?: string;
  /**
   * Declared headers the contract sends only when known (the `Retry-After` of a `503` whose delay
   * the gateway does not know): the case checks that they are absent instead of present.
   */
  readonly absentHeaders?: readonly string[];
  /** Further checks of the response. */
  readonly check?: (response: request.Response, fakes: CaseFakes) => void;
}

/**
 * Function credentialHeaders
 *
 * @description
 * The `Cookie` and `Authorization` headers of a credential.
 *
 * @param {CaseCredential} credential - The credential.
 * @returns {Record<string, string>} The headers.
 */
function credentialHeaders(credential: CaseCredential): Record<string, string> {
  switch (credential) {
    case 'session':
      return { Cookie: `__Host-cw_session=${CAMILLE_ORGANIZATION_TOKEN}` };
    case 'session-without-organization':
      return { Cookie: `__Host-cw_session=${CAMILLE_TOKEN}` };
    case 'members-token':
      return { Authorization: `Bearer ${MEMBERS_TOKEN}` };
    case 'tasks-token':
      return { Authorization: `Bearer ${TASKS_TOKEN}` };
    case 'none':
      return {};
    default:
      return {
        ...(credential.cookie === undefined
          ? {}
          : { Cookie: `__Host-cw_session=${credential.cookie}` }),
        ...(credential.bearer === undefined ? {} : { Authorization: credential.bearer }),
      };
  }
}

/**
 * Sends the request of a route case and checks its answer against the public contract and the
 * case.
 *
 * @param application - Application under test.
 * @param identity - The fake of identity-service.
 * @param routeCase - The case.
 * @returns The response.
 */
export async function runRouteCase(
  application: RouteApplication,
  identity: FakeIdentity,
  routeCase: RouteCase,
): Promise<request.Response> {
  const fakes: CaseFakes = {
    identity,
    organization: application.organization,
    task: application.task,
    counter: application.counter,
    anonymousCounter: application.anonymousCounter,
    bearerFailureCounter: application.bearerFailureCounter,
  };
  routeCase.arrange?.(fakes);
  const unsafe: boolean = routeCase.method !== 'get' && routeCase.method !== 'query';
  const origin: string | null =
    routeCase.origin === undefined ? (unsafe ? ALLOWED_ORIGIN : null) : routeCase.origin;
  let pending: request.Test = request(application.server)[routeCase.method](
    routeCase.url,
  ) as request.Test;
  const headers: Record<string, string> = {
    ...credentialHeaders(routeCase.credential ?? 'session'),
    ...(origin === null ? {} : { Origin: origin }),
    ...routeCase.headers,
  };
  for (const [name, value] of Object.entries(headers)) {
    pending = pending.set(name, value);
  }
  const response: request.Response =
    routeCase.body === undefined ? await pending : await pending.send(routeCase.body as object);
  expectPublicResponse(routeCase.method, routeCase.path, response, routeCase.absentHeaders);
  expect(response.status, JSON.stringify(response.body)).toBe(routeCase.status);
  for (const name of routeCase.absentHeaders ?? []) {
    expect(response.headers[name.toLowerCase()], name).toBeUndefined();
  }
  if (routeCase.code !== undefined) {
    expect(response.body).toMatchObject({ code: routeCase.code });
  }
  routeCase.check?.(response, fakes);
  return response;
}

/**
 * Checks that the cases of a route answer every status its operation declares, so that the
 * success and every declared error are exercised.
 *
 * @param cases - The cases of the routes.
 */
export function expectEveryDeclaredStatus(cases: readonly RouteCase[]): void {
  const routes: Set<string> = new Set<string>(
    cases.map((routeCase: RouteCase) => `${routeCase.method} ${routeCase.path}`),
  );
  for (const route of routes) {
    const [method, path] = route.split(' ') as [SpecMethod, string];
    const exercised: Set<number> = new Set<number>(
      cases
        .filter((routeCase: RouteCase) => `${routeCase.method} ${routeCase.path}` === route)
        .map((routeCase: RouteCase) => routeCase.status),
    );
    expect([...declaredStatuses(method, path)].sort(), route).toEqual([...exercised].sort());
  }
}
