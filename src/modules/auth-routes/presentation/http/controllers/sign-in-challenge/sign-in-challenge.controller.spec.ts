import type {
  SecurityKeyAssertionOptions,
  SessionIssued,
  SignInChallenge,
} from '@cadenway/contracts/types/internal/identity-service';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  CAMILLE,
  CAMILLE_SESSION,
  createFakeIdentity,
  identityProblem,
  identityUnavailable,
  type FakeIdentity,
} from '../../../../../../../tests/support/fake-identity.js';
import {
  createRouteApplication,
  type RouteApplication,
} from '../../../../../../../tests/support/route-application.js';
import {
  expectEveryDeclaredStatus,
  runRouteCase,
  type RouteCase,
} from '../../../../../../../tests/support/route-cases.js';
import type { SpecMethod } from '../../../../../../../tests/support/public-contract.js';

/**
 * Constant BASE
 *
 * @description
 * Public path of the routes under test.
 *
 * @type {string}
 */
const BASE: string = '/v1/auth/sign-in/challenge';

/**
 * Constant CHALLENGE_TOKEN
 *
 * @description
 * Token of the challenge the browser sends back: a secret that must never reach a log line.
 *
 * @type {string}
 */
const CHALLENGE_TOKEN: string = 'ChallengeTokenOfCamilleSecret0000000000000';

/**
 * Constant APP_CODE
 *
 * @description
 * A code of the authenticator app: a secret.
 *
 * @type {string}
 */
const APP_CODE: string = '261845';

/**
 * Constant BACKUP_CODE
 *
 * @description
 * A backup code, as typed: a secret.
 *
 * @type {string}
 */
const BACKUP_CODE: string = '4f7k2m9q';

/**
 * Constant SESSION_TOKEN
 *
 * @description
 * Session token identity-service returns once: it leaves the gateway in its cookie only.
 *
 * @type {string}
 */
const SESSION_TOKEN: string = 'new-session-token-after-the-challenge-0001';

/**
 * Constant DEVICE_TOKEN
 *
 * @description
 * Trusted device token identity-service returns once, with a character the cookie encodes.
 *
 * @type {string}
 */
const DEVICE_TOKEN: string = 'TrustedDeviceTokenOfCamille/0000000000000000';

/**
 * Constant SIGNATURE
 *
 * @description
 * Signature of the answer of a security key: a value of the WebAuthn payload never logged.
 *
 * @type {string}
 */
const SIGNATURE: string = 'SignatureOfTheKeyThatMustNeverBeLogged0000';

/**
 * Constant BROWSER_HEADERS
 *
 * @description
 * Headers of the browser of the route cases: the address Traefik saw and a User-Agent.
 *
 * @type {Readonly<Record<string, string>>}
 */
const BROWSER_HEADERS: Readonly<Record<string, string>> = {
  'X-Forwarded-For': '86.247.12.30',
  'User-Agent': 'Firefox',
};

/**
 * Constant BROWSER
 *
 * @description
 * The `client` the gateway sends for the browser of the route cases.
 *
 * @type {{ ipAddress: string; userAgent: string }}
 */
const BROWSER: { ipAddress: string; userAgent: string } = {
  ipAddress: '86.247.12.30',
  userAgent: 'Firefox',
};

/**
 * Constant CHALLENGE
 *
 * @description
 * The challenge of Camille, as identity-service issues it (example of the internal contract).
 *
 * @type {SignInChallenge}
 */
const CHALLENGE: SignInChallenge = {
  token: CHALLENGE_TOKEN,
  expiresAt: '2026-11-09T07:52:00Z',
  email: CAMILLE.email,
  name: CAMILLE.name,
  primaryMethod: 'authenticator-app',
  methods: ['authenticator-app', 'security-key', 'backup-code'],
  securityKeys: [{ name: 'YubiKey 5C NFC' }, { name: 'Touch ID (MacBook Air)' }],
  backupCodesRemaining: 7,
  lockedUntil: null,
};

/**
 * Constant CREDENTIAL
 *
 * @description
 * The answer of a security key, as the browser serializes it, with a member the contract does
 * not list.
 *
 * @type {Record<string, unknown>}
 */
const CREDENTIAL: Record<string, unknown> = {
  id: 'CredentialIdYubiKey5CNfc0000000000000000000',
  rawId: 'CredentialIdYubiKey5CNfc0000000000000000000',
  type: 'public-key',
  response: {
    clientDataJSON: 'ClientDataJsonOfTheKey',
    authenticatorData: 'AuthenticatorDataOfTheKey',
    signature: SIGNATURE,
    userHandle: 'UserHandleOfCamille',
  },
  authenticatorAttachment: 'cross-platform',
  clientExtensionResults: {},
  futureMember: { kept: true },
};

/**
 * Constant OPTIONS
 *
 * @description
 * WebAuthn options of a challenge, with members the contract does not list.
 *
 * @type {SecurityKeyAssertionOptions}
 */
const OPTIONS: SecurityKeyAssertionOptions = {
  options: {
    challenge: 'WebAuthnChallengeOfTheOptions00000000000000',
    rpId: 'cadenway.com',
    timeout: 300000,
    userVerification: 'preferred',
    allowCredentials: [
      {
        id: 'CredentialIdYubiKey5CNfc0000000000000000000',
        type: 'public-key',
        transports: ['usb', 'nfc'],
      },
    ],
    hints: ['security-key'],
  },
  expiresAt: '2026-11-09T07:47:00Z',
};

/**
 * Function inSeconds
 *
 * @description
 * An instant some seconds from now, as identity-service writes it in `details`.
 *
 * @param {number} seconds - Seconds from now.
 * @returns {string} The ISO 8601 instant.
 */
function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Function issued
 *
 * @description
 * Answer of identity-service to a right answer of the challenge.
 *
 * @param {boolean} trusted - Whether identity-service returns a trusted device.
 * @returns {SessionIssued} The session opened.
 */
function issued(trusted: boolean): SessionIssued {
  return {
    token: SESSION_TOKEN,
    session: {
      id: CAMILLE_SESSION.sessionId,
      expiresAt: '2026-12-09T07:42:00Z',
      persistent: false,
    },
    user: { ...CAMILLE },
    ...(trusted
      ? { trustedDevice: { token: DEVICE_TOKEN, expiresAt: '2026-12-09T07:42:00Z' } }
      : {}),
  };
}

/**
 * Constant DEVICE_COOKIE
 *
 * @description
 * The `Set-Cookie` of the trusted device, with exactly the attributes of the contract.
 *
 * @type {string}
 */
const DEVICE_COOKIE: string = `__Host-cw_trusted_device=${encodeURIComponent(DEVICE_TOKEN)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`;

/**
 * Constant SESSION_COOKIE
 *
 * @description
 * The `Set-Cookie` of the session opened, which ends with the browser.
 *
 * @type {string}
 */
const SESSION_COOKIE: string = `__Host-cw_session=${SESSION_TOKEN}; Path=/; Secure; HttpOnly; SameSite=Lax`;

/**
 * Interface Answer
 *
 * @description
 * A route that answers the challenge, with the method of the fake it calls and a valid body.
 */
interface Answer {
  // #region Properties
  /**
   * Property path
   *
   * @description
   * Path of the route.
   *
   * @type {string}
   * @readonly
   */
  readonly path: string;

  /**
   * Property method
   *
   * @description
   * Method of the fake of identity-service the route calls.
   *
   * @type {'answerSignInChallengeWithAuthenticatorApp' | 'answerSignInChallengeWithBackupCode' | 'answerSignInChallengeWithSecurityKey'}
   * @readonly
   */
  readonly method:
    | 'answerSignInChallengeWithAuthenticatorApp'
    | 'answerSignInChallengeWithBackupCode'
    | 'answerSignInChallengeWithSecurityKey';

  /**
   * Property body
   *
   * @description
   * A body the schema of the route accepts.
   *
   * @type {Record<string, unknown>}
   * @readonly
   */
  readonly body: Record<string, unknown>;

  /**
   * Property refusal
   *
   * @description
   * The `422` of a wrong answer, besides `auth.challenge-expired`.
   *
   * @type {string}
   * @readonly
   */
  readonly refusal: string;
  // #endregion
}

/**
 * Constant ANSWERS
 *
 * @description
 * The three answers of a challenge.
 *
 * @type {readonly Answer[]}
 */
const ANSWERS: readonly Answer[] = [
  {
    path: `${BASE}/authenticator-app`,
    method: 'answerSignInChallengeWithAuthenticatorApp',
    body: { token: CHALLENGE_TOKEN, code: APP_CODE },
    refusal: 'auth.two-step-code-invalid',
  },
  {
    path: `${BASE}/backup-code`,
    method: 'answerSignInChallengeWithBackupCode',
    body: { token: CHALLENGE_TOKEN, code: BACKUP_CODE },
    refusal: 'auth.two-step-code-invalid',
  },
  {
    path: `${BASE}/security-key`,
    method: 'answerSignInChallengeWithSecurityKey',
    body: { token: CHALLENGE_TOKEN, credential: CREDENTIAL },
    refusal: 'auth.security-key-refused',
  },
];

/**
 * Function post
 *
 * @description
 * A route case of a `POST` without a credential, from the browser of the cases.
 *
 * @param {string} path - Path of the route.
 * @param {Omit<RouteCase, 'method' | 'path' | 'url'>} routeCase - The rest of the case.
 * @returns {RouteCase} The case.
 */
function post(path: string, routeCase: Omit<RouteCase, 'method' | 'path' | 'url'>): RouteCase {
  const method: SpecMethod = 'post';
  return {
    method,
    path,
    url: path,
    credential: 'none',
    headers: BROWSER_HEADERS,
    ...routeCase,
  };
}

/**
 * Function commonCases
 *
 * @description
 * The refusals every route of the challenge shares: an invalid body, another origin, the limit of
 * the client address and an identity-service that cannot answer.
 *
 * @param {string} path - Path of the route.
 * @param {Record<string, unknown>} body - A valid body.
 * @returns {RouteCase[]} The cases.
 */
function commonCases(path: string, body: Record<string, unknown>): RouteCase[] {
  return [
    post(path, {
      name: `POST ${path} refuses a body without its token before identity-service`,
      body: { ...body, token: undefined },
      status: 400,
      code: 'request.invalid',
    }),
    post(path, {
      name: `POST ${path} refuses another origin before anything else`,
      body,
      origin: 'https://evil.test',
      status: 403,
      code: 'auth.csrf-rejected',
      check: (_response, { anonymousCounter }) => {
        expect(anonymousCounter.consume).not.toHaveBeenCalled();
      },
    }),
    post(path, {
      name: `POST ${path} answers 429 rate-limit.exceeded beyond the quota of the address`,
      body,
      arrange: ({ anonymousCounter }) =>
        anonymousCounter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 }),
      status: 429,
      code: 'rate-limit.exceeded',
      check: (response) => {
        expect(response.headers['retry-after']).toBe('12');
      },
    }),
    post(path, {
      name: `POST ${path} answers 503 when identity-service cannot answer`,
      body,
      arrange: ({ identity }) => {
        identity.inspectSignInChallenge.mockRejectedValue(identityUnavailable());
        identity.answerSignInChallengeWithAuthenticatorApp.mockRejectedValue(identityUnavailable());
        identity.answerSignInChallengeWithBackupCode.mockRejectedValue(identityUnavailable());
        identity.getSignInChallengeSecurityKeyOptions.mockRejectedValue(identityUnavailable());
        identity.answerSignInChallengeWithSecurityKey.mockRejectedValue(identityUnavailable());
      },
      status: 503,
      code: 'upstream.unavailable',
    }),
  ];
}

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of the routes of the two-step challenge.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  post(`${BASE}/inspection`, {
    name: 'POST inspection answers the challenge as the sign-in issued it, as nobody',
    body: { token: CHALLENGE_TOKEN },
    arrange: ({ identity }) => identity.inspectSignInChallenge.mockResolvedValue(CHALLENGE),
    status: 200,
    check: (response, { identity, anonymousCounter }) => {
      expect(response.body).toEqual(CHALLENGE);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers['cache-control']).toBe('no-store');
      expect(identity.inspectSignInChallenge).toHaveBeenCalledWith({ token: CHALLENGE_TOKEN });
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(anonymousCounter.consume).toHaveBeenCalledTimes(1);
    },
  }),
  post(`${BASE}/inspection`, {
    name: 'POST inspection relays 422 auth.challenge-expired with its French title',
    body: { token: CHALLENGE_TOKEN },
    arrange: ({ identity }) =>
      identity.inspectSignInChallenge.mockRejectedValue(
        identityProblem(422, 'auth.challenge-expired'),
      ),
    status: 422,
    check: (response) => {
      expect(response.body).toEqual({
        type: 'about:blank',
        title: 'La vérification a expiré : connectez-vous de nouveau.',
        status: 422,
        code: 'auth.challenge-expired',
      });
      expect(response.headers['cache-control']).toBe('no-store');
    },
  }),
  ...commonCases(`${BASE}/inspection`, { token: CHALLENGE_TOKEN }),
  post(`${BASE}/security-key/options`, {
    name: 'POST security-key/options passes the WebAuthn options on whole',
    body: { token: CHALLENGE_TOKEN },
    arrange: ({ identity }) =>
      identity.getSignInChallengeSecurityKeyOptions.mockResolvedValue(OPTIONS),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(OPTIONS);
      expect(identity.getSignInChallengeSecurityKeyOptions).toHaveBeenCalledWith({
        token: CHALLENGE_TOKEN,
      });
    },
  }),
  post(`${BASE}/security-key/options`, {
    name: 'POST security-key/options relays 422 auth.security-key-refused for an account without a key',
    body: { token: CHALLENGE_TOKEN },
    arrange: ({ identity }) =>
      identity.getSignInChallengeSecurityKeyOptions.mockRejectedValue(
        identityProblem(422, 'auth.security-key-refused'),
      ),
    status: 422,
    code: 'auth.security-key-refused',
  }),
  post(`${BASE}/security-key/options`, {
    name: 'POST security-key/options relays 429 auth.two-step-locked with Retry-After',
    body: { token: CHALLENGE_TOKEN },
    arrange: ({ identity }) =>
      identity.getSignInChallengeSecurityKeyOptions.mockRejectedValue(
        identityProblem(429, 'auth.two-step-locked', { lockedUntil: inSeconds(600) }),
      ),
    status: 429,
    code: 'auth.two-step-locked',
    check: (response) => {
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(590);
    },
  }),
  ...commonCases(`${BASE}/security-key/options`, { token: CHALLENGE_TOKEN }),
  ...ANSWERS.flatMap((answer: Answer): RouteCase[] => [
    post(answer.path, {
      name: `POST ${answer.path} signs in with the session cookie only, without trustDevice`,
      body: answer.body,
      arrange: ({ identity }) => identity[answer.method].mockResolvedValue(issued(false)),
      status: 200,
      check: (response, { identity }) => {
        expect(response.headers['set-cookie']).toEqual([SESSION_COOKIE]);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({
          user: CAMILLE,
          session: { id: CAMILLE_SESSION.sessionId, expiresAt: '2026-12-09T07:42:00Z' },
        });
        expect(identity[answer.method]).toHaveBeenCalledWith({
          ...answer.body,
          trustDevice: false,
          client: BROWSER,
        });
        expect(identity.introspect).not.toHaveBeenCalled();
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} sets the trusted device cookie with the attributes of the contract`,
      body: { ...answer.body, trustDevice: true },
      arrange: ({ identity }) => identity[answer.method].mockResolvedValue(issued(true)),
      status: 200,
      check: (response) => {
        expect(response.headers['set-cookie']).toEqual([SESSION_COOKIE, DEVICE_COOKIE]);
        expect(JSON.stringify(response.body)).not.toContain(DEVICE_TOKEN);
        expect(JSON.stringify(response.body)).not.toContain(SESSION_TOKEN);
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} sets the session cookie only when identity-service returns no trusted device`,
      body: { ...answer.body, trustDevice: true },
      arrange: ({ identity }) => identity[answer.method].mockResolvedValue(issued(false)),
      status: 200,
      check: (response) => {
        expect(response.headers['set-cookie']).toEqual([SESSION_COOKIE]);
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} writes no device cookie the answer did not ask for`,
      body: { ...answer.body, trustDevice: false },
      arrange: ({ identity }) => identity[answer.method].mockResolvedValue(issued(true)),
      status: 200,
      check: (response) => {
        expect(response.headers['set-cookie']).toEqual([SESSION_COOKIE]);
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} relays 422 auth.challenge-expired`,
      body: answer.body,
      arrange: ({ identity }) =>
        identity[answer.method].mockRejectedValue(identityProblem(422, 'auth.challenge-expired')),
      status: 422,
      code: 'auth.challenge-expired',
      check: (response) => {
        expect(response.headers['set-cookie']).toBeUndefined();
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} relays 422 ${answer.refusal} with the attempts left`,
      body: answer.body,
      arrange: ({ identity }) =>
        identity[answer.method].mockRejectedValue(
          identityProblem(422, answer.refusal, { remainingAttempts: 4 }),
        ),
      status: 422,
      code: answer.refusal,
      check: (response) => {
        expect(response.body).toMatchObject({ details: { remainingAttempts: 4 } });
        expect(response.body).not.toHaveProperty('details.service');
        expect(response.headers['set-cookie']).toBeUndefined();
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} relays 429 auth.two-step-locked with Retry-After and its French title`,
      body: answer.body,
      arrange: ({ identity }) =>
        identity[answer.method].mockRejectedValue(
          identityProblem(429, 'auth.two-step-locked', { lockedUntil: inSeconds(900) }),
        ),
      status: 429,
      check: (response) => {
        expect(response.body).toMatchObject({
          code: 'auth.two-step-locked',
          title: 'Trop de tentatives échouées : réessayez dans 15 minutes.',
        });
        const retryAfter: number = Number(response.headers['retry-after']);
        expect(retryAfter).toBeGreaterThan(890);
        expect(retryAfter).toBeLessThanOrEqual(900);
      },
    }),
    post(answer.path, {
      name: `POST ${answer.path} answers a refusal its contract does not declare as 503 upstream.failed`,
      body: answer.body,
      arrange: ({ identity }) =>
        identity[answer.method].mockRejectedValue(
          identityProblem(409, 'auth.two-step-not-enabled'),
        ),
      status: 503,
      code: 'upstream.failed',
    }),
    ...commonCases(answer.path, answer.body),
  ]),
  post(`${BASE}/authenticator-app`, {
    name: 'POST authenticator-app refuses a code that is not 6 digits before identity-service',
    body: { token: CHALLENGE_TOKEN, code: '26184' },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.answerSignInChallengeWithAuthenticatorApp).not.toHaveBeenCalled();
    },
  }),
  post(`${BASE}/security-key`, {
    name: 'POST security-key passes the answer of the key on whole, members the contract does not list included',
    body: { token: CHALLENGE_TOKEN, credential: CREDENTIAL, trustDevice: true },
    arrange: ({ identity }) =>
      identity.answerSignInChallengeWithSecurityKey.mockResolvedValue(issued(true)),
    status: 200,
    check: (_response, { identity }) => {
      expect(identity.answerSignInChallengeWithSecurityKey).toHaveBeenCalledWith({
        token: CHALLENGE_TOKEN,
        credential: CREDENTIAL,
        trustDevice: true,
        client: BROWSER,
      });
    },
  }),
  post(`${BASE}/authenticator-app`, {
    name: 'POST authenticator-app ignores a stale session cookie and a trusted device cookie: the route carries no credential',
    body: { token: CHALLENGE_TOKEN, code: APP_CODE },
    headers: {
      ...BROWSER_HEADERS,
      Cookie: '__Host-cw_session=revoked-token; __Host-cw_trusted_device=older-device-token',
    },
    arrange: ({ identity }) =>
      identity.answerSignInChallengeWithAuthenticatorApp.mockResolvedValue(issued(false)),
    status: 200,
    check: (_response, { identity }) => {
      expect(identity.introspect).not.toHaveBeenCalled();
      expect(identity.answerSignInChallengeWithAuthenticatorApp).toHaveBeenCalledWith({
        token: CHALLENGE_TOKEN,
        code: APP_CODE,
        trustDevice: false,
        client: BROWSER,
      });
    },
  }),
];

describe('routes of /v1/auth/sign-in/challenge', () => {
  let identity: FakeIdentity;
  let application: RouteApplication;

  beforeAll(async () => {
    identity = createFakeIdentity();
    application = await createRouteApplication(identity);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await application.app.close();
  });

  it('exercises every status each route declares', () => {
    expectEveryDeclaredStatus(CASES);
  });

  it.each(CASES.map((routeCase: RouteCase) => [routeCase.name, routeCase] as const))(
    '%s',
    async (_name, routeCase) => {
      await runRouteCase(application, identity, routeCase);
    },
  );

  it('counts each answer on a pseudonym of the client address, never on the address', async () => {
    identity.answerSignInChallengeWithAuthenticatorApp.mockRejectedValue(
      identityProblem(422, 'auth.two-step-code-invalid', { remainingAttempts: 3 }),
    );

    await runRouteCase(
      application,
      identity,
      post(`${BASE}/authenticator-app`, {
        name: 'answer',
        body: { token: CHALLENGE_TOKEN, code: APP_CODE },
        status: 422,
      }),
    );

    const keys: string[] = application.anonymousCounter.consume.mock.calls.map(
      ([key]: [string]) => key,
    );
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^anonymous:[\w-]{22}$/u);
    expect(keys[0]).not.toContain('86.247.12.30');
    expect(application.counter.consume).not.toHaveBeenCalled();
  });

  it('never writes the device cookie, the challenge token or the password of a sign-in answered 202 into the logs', async () => {
    application.logLines.length = 0;
    const deviceToken: string = 'TrustedDeviceTokenOfThisBrowser000000000000';
    const password: string = 'atelier-nord-sprint-14-secret';
    identity.signInWithPassword.mockResolvedValue({ outcome: 'challenge', challenge: CHALLENGE });

    await runRouteCase(
      application,
      identity,
      post('/v1/auth/sign-in', {
        name: 'sign-in',
        body: { email: CAMILLE.email, password },
        headers: { ...BROWSER_HEADERS, Cookie: `__Host-cw_trusted_device=${deviceToken}` },
        status: 202,
      }),
    );

    const logs: string = application.logLines.join('\n');
    expect(application.logLines.length).toBeGreaterThan(0);
    expect(identity.signInWithPassword.mock.calls[0]?.[0]).toMatchObject({
      trustedDeviceToken: deviceToken,
    });
    expect(logs).not.toContain(deviceToken);
    expect(logs).not.toContain(CHALLENGE_TOKEN);
    expect(logs).not.toContain(password);
  });

  it('never writes a challenge token, a code, a session or device token or a WebAuthn payload into the logs', async () => {
    application.logLines.length = 0;
    identity.inspectSignInChallenge.mockResolvedValue(CHALLENGE);
    identity.getSignInChallengeSecurityKeyOptions.mockResolvedValue(OPTIONS);
    for (const answer of ANSWERS) {
      identity[answer.method]
        .mockRejectedValueOnce(identityProblem(422, answer.refusal, { remainingAttempts: 2 }))
        .mockResolvedValueOnce(issued(true));
    }

    await runRouteCase(
      application,
      identity,
      post(`${BASE}/inspection`, {
        name: 'inspection',
        body: { token: CHALLENGE_TOKEN },
        status: 200,
      }),
    );
    await runRouteCase(
      application,
      identity,
      post(`${BASE}/security-key/options`, {
        name: 'options',
        body: { token: CHALLENGE_TOKEN },
        status: 200,
      }),
    );
    for (const answer of ANSWERS) {
      await runRouteCase(
        application,
        identity,
        post(answer.path, { name: 'refused', body: answer.body, status: 422 }),
      );
      await runRouteCase(
        application,
        identity,
        post(answer.path, {
          name: 'accepted',
          body: { ...answer.body, trustDevice: true },
          status: 200,
        }),
      );
    }

    const logs: string = application.logLines.join('\n');
    expect(application.logLines.length).toBeGreaterThan(0);
    for (const secret of [
      CHALLENGE_TOKEN,
      APP_CODE,
      BACKUP_CODE,
      SESSION_TOKEN,
      DEVICE_TOKEN,
      encodeURIComponent(DEVICE_TOKEN),
      SIGNATURE,
      OPTIONS.options.challenge,
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});
