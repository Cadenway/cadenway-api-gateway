import type {
  AuthenticatorAppConfigured,
  BackupCodes,
  SecurityKey,
  SecurityKeyRegistration,
  TwoStepVerification,
} from '@cadenway/contracts/types/internal/identity-service';
import { getOrganizationContext, type OrganizationContext } from '@cadenway/nest-common';
import type request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ATELIER_NORD_ID,
  CAMILLE,
  CAMILLE_ORGANIZATION_SESSION,
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
  type CaseFakes,
  type RouteCase,
} from '../../../../../../../tests/support/route-cases.js';

/**
 * Constant BASE
 *
 * @description
 * Public path of the routes under test.
 *
 * @type {string}
 */
const BASE: string = '/v1/me/two-step-verification';

/**
 * Constant SESSION_ID
 *
 * @description
 * Id of the session of the default credential of the route cases, Camille in Atelier Nord.
 *
 * @type {string}
 */
const SESSION_ID: string = CAMILLE_ORGANIZATION_SESSION.sessionId;

/**
 * Constant BROWSER
 *
 * @description
 * User-Agent of the browser of the route cases that send one.
 *
 * @type {string}
 */
const BROWSER: string =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';

/**
 * Constant CLIENT
 *
 * @description
 * The `client` the gateway sends for a request of supertest with `BROWSER`: the socket address,
 * no proxy in front.
 *
 * @type {{ ipAddress: string; userAgent: string }}
 */
const CLIENT: { ipAddress: string; userAgent: string } = {
  ipAddress: '127.0.0.1',
  userAgent: BROWSER,
};

/**
 * Constant KEY_ID
 *
 * @description
 * Id of the security key of the mockup, YubiKey 5C NFC.
 *
 * @type {string}
 */
const KEY_ID: string = '019a6c52-1d2e-7f3a-8b4c-5d6e7f8a9b01';

/**
 * Constant SECRET
 *
 * @description
 * TOTP secret of the example of the contract: a secret that must never reach a log line.
 *
 * @type {string}
 */
const SECRET: string = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

/**
 * Constant OTPAUTH_URI
 *
 * @description
 * `otpauth://` URI of `SECRET`.
 *
 * @type {string}
 */
const OTPAUTH_URI: string = `otpauth://totp/Cadenway:camille.martin%40ateliernord.fr?secret=${SECRET}&issuer=Cadenway&algorithm=SHA1&digits=6&period=30`;

/**
 * Constant CODE
 *
 * @description
 * Code of the new authenticator app that confirms the setup.
 *
 * @type {string}
 */
const CODE: string = '261845';

/**
 * Constant CODES
 *
 * @description
 * The 10 backup codes of the example of the contract.
 *
 * @type {string[]}
 */
const CODES: string[] = [
  '4F7K-2M9Q',
  'H3XP-8D2L',
  'Q9TZ-5W1C',
  'B6NR-7J4E',
  'K2VD-9S8A',
  'M8LC-3F6P',
  'T5QW-1H7Z',
  'R4GY-6B3N',
  'C7EJ-2K5U',
  'W1PS-8V9D',
];

/**
 * Constant KEY
 *
 * @description
 * The security key of the mockup, as identity-service answers it.
 *
 * @type {SecurityKey}
 */
const KEY: SecurityKey = {
  id: KEY_ID,
  name: 'YubiKey 5C NFC',
  createdAt: '2026-03-03T10:20:00Z',
  lastUsedAt: '2026-11-09T07:42:00Z',
};

/**
 * Constant STATE
 *
 * @description
 * The two-step verification of Camille in the mockup, as identity-service answers it.
 *
 * @type {TwoStepVerification}
 */
const STATE: TwoStepVerification = {
  enabled: true,
  primaryMethod: 'authenticator-app',
  methods: ['authenticator-app', 'security-key'],
  authenticatorApp: { configuredAt: '2026-03-03T10:15:00Z' },
  securityKeys: [KEY],
  backupCodes: { remaining: 7, total: 10, generatedAt: '2026-03-03T10:15:00Z' },
  requiredBy: [{ organizationId: ATELIER_NORD_ID, requiredFor: 'admins' }],
};

/**
 * Constant CONFIGURED
 *
 * @description
 * Answer of a first confirmation of the app: two-step verification turned on, 10 backup codes.
 *
 * @type {AuthenticatorAppConfigured}
 */
const CONFIGURED: AuthenticatorAppConfigured = {
  twoStepVerification: {
    enabled: true,
    primaryMethod: 'authenticator-app',
    methods: ['authenticator-app'],
    authenticatorApp: { configuredAt: '2026-11-09T13:21:00Z' },
    securityKeys: [],
    backupCodes: { remaining: 10, total: 10, generatedAt: '2026-11-09T13:21:00Z' },
    requiredBy: [],
  },
  backupCodes: { codes: CODES, generatedAt: '2026-11-09T13:21:00Z' },
};

/**
 * Constant BACKUP_CODES
 *
 * @description
 * Answer of a regeneration of the backup codes.
 *
 * @type {BackupCodes}
 */
const BACKUP_CODES: BackupCodes = { codes: CODES, generatedAt: '2026-11-08T16:05:00Z' };

/**
 * Constant REGISTRATION
 *
 * @description
 * WebAuthn creation options of the example of the contract, with members the contract lists only
 * as passed on (`attestation`, `authenticatorSelection`) and one it does not name (`hints`).
 *
 * @type {SecurityKeyRegistration}
 */
const REGISTRATION: SecurityKeyRegistration = {
  options: {
    challenge: 'ExampleOnlyWebAuthnChallenge000000000000000',
    rp: { id: 'cadenway.com', name: 'Cadenway' },
    user: {
      id: 'ExampleOnlyWebAuthnUserHandle00000000000000',
      name: CAMILLE.email,
      displayName: CAMILLE.name,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 },
    ],
    timeout: 300000,
    attestation: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    hints: ['security-key'],
    excludeCredentials: [
      {
        id: 'ExampleOnlyCredentialIdTouchIdMacBookAir00',
        type: 'public-key',
        transports: ['internal'],
      },
    ],
  },
  expiresAt: '2026-11-09T13:26:00Z',
};

/**
 * Constant CREDENTIAL
 *
 * @description
 * Answer of the browser to the registration options, with members the contract does not list, in
 * the credential and in its `response`.
 *
 * @type {Record<string, unknown>}
 */
const CREDENTIAL: Record<string, unknown> = {
  id: 'ExampleOnlyCredentialIdYubiKey5CNfc0000000',
  rawId: 'ExampleOnlyCredentialIdYubiKey5CNfc0000000',
  type: 'public-key',
  response: {
    clientDataJSON: 'SecretClientDataJsonOfTheBrowser',
    attestationObject: 'SecretAttestationObjectOfTheKey',
    transports: ['usb', 'nfc'],
    publicKeyAlgorithm: -7,
  },
  authenticatorAttachment: 'cross-platform',
  clientExtensionResults: {},
  futureMember: 'kept for identity-service',
};

/**
 * Constant ADDITION
 *
 * @description
 * Body of the addition of a key.
 *
 * @type {{ name: string; credential: Record<string, unknown> }}
 */
const ADDITION: { name: string; credential: Record<string, unknown> } = {
  name: 'YubiKey 5C NFC',
  credential: CREDENTIAL,
};

/**
 * Function reauthenticationRequired
 *
 * @description
 * What identity-service throws for a guarded route without a recent two-step proof.
 *
 * @returns {ReturnType<typeof identityProblem>} The problem.
 */
function reauthenticationRequired(): ReturnType<typeof identityProblem> {
  return identityProblem(403, 'auth.reauthentication-required', {
    methods: ['authenticator-app'],
  });
}

/**
 * Function expectReauthenticationRequired
 *
 * @description
 * Checks the relayed `403 auth.reauthentication-required`: its French title and its methods.
 *
 * @param {request.Response} response - The response.
 */
function expectReauthenticationRequired(response: request.Response): void {
  expect(response.body).toEqual({
    type: 'about:blank',
    title: 'Confirmez votre identité pour continuer.',
    status: 403,
    code: 'auth.reauthentication-required',
    details: { methods: ['authenticator-app'] },
  });
}

/**
 * Function expectNoStore
 *
 * @description
 * Checks that the answer stays out of every cache.
 *
 * @param {request.Response} response - The response.
 */
function expectNoStore(response: request.Response): void {
  expect(response.headers['cache-control']).toBe('no-store');
}

/**
 * Interface Route
 *
 * @description
 * A route of the controller, with a request its schema accepts and an arrangement of a success.
 */
interface Route {
  // #region Properties
  /**
   * Property label
   *
   * @description
   * `<METHOD> <path>` for the names of the cases.
   *
   * @type {string}
   * @readonly
   */
  readonly label: string;

  /**
   * Property request
   *
   * @description
   * Method, spec path, URL, body and headers of a valid request.
   *
   * @type {Pick<RouteCase, 'method' | 'path' | 'url' | 'body' | 'headers'>}
   * @readonly
   */
  readonly request: Pick<RouteCase, 'method' | 'path' | 'url' | 'body' | 'headers'>;

  /**
   * Property fail
   *
   * @description
   * Makes the internal call of the route fail with a problem.
   *
   * @type {(fakes: CaseFakes, error: unknown) => void}
   * @readonly
   */
  readonly fail: (fakes: CaseFakes, error: unknown) => void;
  // #endregion
}

/**
 * Constant BROWSER_HEADERS
 *
 * @description
 * Headers of a request of the browser.
 *
 * @type {Readonly<Record<string, string>>}
 */
const BROWSER_HEADERS: Readonly<Record<string, string>> = { 'User-Agent': BROWSER };

/**
 * Constant ROUTES
 *
 * @description
 * The eight routes of the controller.
 *
 * @type {Readonly<Record<string, Route>>}
 */
const ROUTES = {
  read: {
    label: `GET ${BASE}`,
    request: { method: 'get', path: BASE, url: BASE },
    fail: ({ identity }, error) => identity.getTwoStepVerification.mockRejectedValue(error),
  },
  disable: {
    label: `DELETE ${BASE}`,
    request: { method: 'delete', path: BASE, url: BASE, headers: BROWSER_HEADERS },
    fail: ({ identity }, error) => identity.disableTwoStepVerification.mockRejectedValue(error),
  },
  setup: {
    label: `POST ${BASE}/authenticator-app/setup`,
    request: {
      method: 'post',
      path: `${BASE}/authenticator-app/setup`,
      url: `${BASE}/authenticator-app/setup`,
      body: {},
    },
    fail: ({ identity }, error) => identity.startAuthenticatorAppSetup.mockRejectedValue(error),
  },
  confirmation: {
    label: `POST ${BASE}/authenticator-app/setup/confirmation`,
    request: {
      method: 'post',
      path: `${BASE}/authenticator-app/setup/confirmation`,
      url: `${BASE}/authenticator-app/setup/confirmation`,
      body: { code: CODE },
      headers: BROWSER_HEADERS,
    },
    fail: ({ identity }, error) => identity.confirmAuthenticatorAppSetup.mockRejectedValue(error),
  },
  regenerate: {
    label: `POST ${BASE}/backup-codes/regenerate`,
    request: {
      method: 'post',
      path: `${BASE}/backup-codes/regenerate`,
      url: `${BASE}/backup-codes/regenerate`,
      body: {},
      headers: BROWSER_HEADERS,
    },
    fail: ({ identity }, error) => identity.regenerateBackupCodes.mockRejectedValue(error),
  },
  registration: {
    label: `POST ${BASE}/security-keys/registration`,
    request: {
      method: 'post',
      path: `${BASE}/security-keys/registration`,
      url: `${BASE}/security-keys/registration`,
      body: {},
    },
    fail: ({ identity }, error) => identity.startSecurityKeyRegistration.mockRejectedValue(error),
  },
  addition: {
    label: `POST ${BASE}/security-keys`,
    request: {
      method: 'post',
      path: `${BASE}/security-keys`,
      url: `${BASE}/security-keys`,
      body: ADDITION,
      headers: BROWSER_HEADERS,
    },
    fail: ({ identity }, error) => identity.addSecurityKey.mockRejectedValue(error),
  },
  removal: {
    label: `DELETE ${BASE}/security-keys/{securityKeyId}`,
    request: {
      method: 'delete',
      path: `${BASE}/security-keys/{securityKeyId}`,
      url: `${BASE}/security-keys/${KEY_ID}`,
      headers: BROWSER_HEADERS,
    },
    fail: ({ identity }, error) => identity.removeSecurityKey.mockRejectedValue(error),
  },
} satisfies Readonly<Record<string, Route>>;

/**
 * Function relayed
 *
 * @description
 * A case where identity-service answers a client error that the route relays as is.
 *
 * @param {Route} route - The route.
 * @param {number} status - Status of the problem.
 * @param {string} code - Code of the problem.
 * @param {Readonly<Record<string, unknown>>} details - Details of the problem.
 * @param {(response: request.Response) => void} check - Further checks.
 * @returns {RouteCase} The case.
 */
function relayed(
  route: Route,
  status: 400 | 403 | 404 | 409 | 422,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
  check?: (response: request.Response) => void,
): RouteCase {
  return {
    name: `${route.label} relays ${String(status)} ${code}`,
    ...route.request,
    arrange: (fakes) => {
      route.fail(fakes, identityProblem(status, code, details));
    },
    status,
    code,
    check: (response) => {
      expect(response.body).not.toHaveProperty('details.service');
      if (Object.keys(details).length > 0) {
        expect(response.body).toMatchObject({ details });
      }
      check?.(response);
    },
  };
}

/**
 * Function commonCases
 *
 * @description
 * The cases every route answers the same way: no cookie, a session that ended after its
 * introspection, a personal API token, another origin, the limit of the session, and
 * identity-service that cannot answer or refuses the internal token.
 *
 * @param {Route} route - The route.
 * @returns {RouteCase[]} The cases.
 */
function commonCases(route: Route): RouteCase[] {
  return [
    {
      name: `${route.label} answers 401 without a session cookie`,
      ...route.request,
      credential: 'none',
      status: 401,
      code: 'auth.session-required',
    },
    ...['session.not-found', 'user.not-found'].map((code: string): RouteCase => ({
      name: `${route.label} answers 404 ${code} as 401 auth.session-expired`,
      ...route.request,
      arrange: (fakes) => {
        route.fail(fakes, identityProblem(404, code));
      },
      status: 401,
      code: 'auth.session-expired',
      check: (response) => {
        expectNoStore(response);
      },
    })),
    {
      name: `${route.label} refuses a personal API token`,
      ...route.request,
      credential: 'members-token',
      status: 403,
      code: 'auth.api-token-not-accepted',
    },
    ...(route.request.method === 'get'
      ? []
      : [
          {
            name: `${route.label} refuses another origin before the introspection`,
            ...route.request,
            origin: 'https://evil.test',
            status: 403,
            code: 'auth.csrf-rejected',
            check: (_response: request.Response, { identity }: CaseFakes) => {
              expect(identity.introspect).not.toHaveBeenCalled();
            },
          } satisfies RouteCase,
        ]),
    {
      name: `${route.label} answers 429 beyond the quota of the session`,
      ...route.request,
      arrange: ({ counter }) =>
        counter.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 7 }),
      status: 429,
      code: 'rate-limit.exceeded',
      check: (response) => {
        expect(response.headers['retry-after']).toBe('7');
      },
    },
    {
      name: `${route.label} answers 503 when identity-service cannot answer`,
      ...route.request,
      arrange: (fakes) => {
        route.fail(fakes, identityUnavailable('circuit-open'));
      },
      status: 503,
      code: 'upstream.circuit-open',
    },
    {
      name: `${route.label} answers a refused internal token as 503 upstream.unauthorized`,
      ...route.request,
      arrange: (fakes) => {
        route.fail(fakes, identityProblem(403, 'auth.actor-not-allowed'));
      },
      status: 503,
      code: 'upstream.unauthorized',
    },
  ];
}

/**
 * Function defectCase
 *
 * @description
 * A case where identity-service refuses a body the gateway built alone (the session of the
 * introspection and the browser): a defect, answered `503 upstream.failed`, never blamed on the
 * browser.
 *
 * @param {Route} route - The route.
 * @returns {RouteCase} The case.
 */
function defectCase(route: Route): RouteCase {
  return {
    name: `${route.label} answers an internal 400 as 503 upstream.failed`,
    ...route.request,
    arrange: (fakes) => {
      route.fail(
        fakes,
        identityProblem(400, 'request.invalid', {
          issues: [{ in: 'body', path: 'sessionId', code: 'invalid_format', message: 'Invalid' }],
        }),
      );
    },
    status: 503,
    code: 'upstream.failed',
  };
}

/**
 * Function strictBodyCase
 *
 * @description
 * A case of a route whose body is the empty object only, sent with a member.
 *
 * @param {Route} route - The route.
 * @returns {RouteCase} The case.
 */
function strictBodyCase(route: Route): RouteCase {
  return {
    name: `${route.label} refuses a body with a member before identity-service`,
    ...route.request,
    body: { sessionId: CAMILLE_SESSION.sessionId },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.startAuthenticatorAppSetup).not.toHaveBeenCalled();
      expect(identity.regenerateBackupCodes).not.toHaveBeenCalled();
      expect(identity.startSecurityKeyRegistration).not.toHaveBeenCalled();
    },
  };
}

/**
 * Constant CASES
 *
 * @description
 * The success and every declared error of each route of the controller.
 *
 * @type {readonly RouteCase[]}
 */
const CASES: readonly RouteCase[] = [
  // GET /v1/me/two-step-verification
  {
    name: `${ROUTES.read.label} answers the two-step verification of the account`,
    ...ROUTES.read.request,
    arrange: ({ identity }) =>
      identity.getTwoStepVerification.mockResolvedValue({
        ...STATE,
        internalNote: 'not public',
      } as TwoStepVerification),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(STATE);
      expectNoStore(response);
      expect(response.headers.etag).toBeUndefined();
      expect(identity.getTwoStepVerification).toHaveBeenCalledWith(CAMILLE.id);
    },
  },
  {
    name: `${ROUTES.read.label} serves a session whose organization is withheld: the account needs none`,
    ...ROUTES.read.request,
    arrange: ({ identity }) => {
      identity.introspect.mockResolvedValue({
        ...CAMILLE_SESSION,
        withheldOrganization: {
          organizationId: ATELIER_NORD_ID,
          code: 'organization.mfa-required',
        },
      });
      identity.getTwoStepVerification.mockResolvedValue({
        enabled: false,
        primaryMethod: null,
        methods: [],
        authenticatorApp: null,
        securityKeys: [],
        backupCodes: null,
        requiredBy: [{ organizationId: ATELIER_NORD_ID, requiredFor: 'everyone' }],
      });
    },
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toMatchObject({ enabled: false, backupCodes: null });
      expect(identity.getTwoStepVerification).toHaveBeenCalledWith(CAMILLE.id);
    },
  },
  ...commonCases(ROUTES.read),

  // DELETE /v1/me/two-step-verification
  {
    name: `${ROUTES.disable.label} turns two-step verification off with the session and the browser`,
    ...ROUTES.disable.request,
    arrange: ({ identity }) => identity.disableTwoStepVerification.mockResolvedValue(),
    status: 204,
    check: (response, { identity }) => {
      expect(response.text).toBe('');
      expectNoStore(response);
      expect(identity.disableTwoStepVerification).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        client: CLIENT,
      });
    },
  },
  {
    name: `${ROUTES.disable.label} refuses a malformed JSON body before identity-service`,
    ...ROUTES.disable.request,
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
    body: '{',
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.disableTwoStepVerification).not.toHaveBeenCalled();
    },
  },
  relayed(
    ROUTES.disable,
    409,
    'auth.mfa-required-by-organization',
    { organizationIds: [ATELIER_NORD_ID] },
    (response) => {
      expect(response.body).toMatchObject({
        title:
          'Une de vos organisations exige la vérification en deux étapes : elle ne peut pas être désactivée.',
      });
    },
  ),
  {
    ...relayed(ROUTES.disable, 403, 'auth.reauthentication-required'),
    arrange: (fakes) => ROUTES.disable.fail(fakes, reauthenticationRequired()),
    check: expectReauthenticationRequired,
  },
  defectCase(ROUTES.disable),
  ...commonCases(ROUTES.disable),

  // POST .../authenticator-app/setup
  {
    name: `${ROUTES.setup.label} answers the secret of the new app, once`,
    ...ROUTES.setup.request,
    arrange: ({ identity }) =>
      identity.startAuthenticatorAppSetup.mockResolvedValue({
        secret: SECRET,
        otpauthUri: OTPAUTH_URI,
        expiresAt: '2026-11-09T13:35:00Z',
      }),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual({
        secret: SECRET,
        otpauthUri: OTPAUTH_URI,
        expiresAt: '2026-11-09T13:35:00Z',
      });
      expectNoStore(response);
      expect(identity.startAuthenticatorAppSetup).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
      });
    },
  },
  strictBodyCase(ROUTES.setup),
  {
    ...relayed(ROUTES.setup, 403, 'auth.reauthentication-required'),
    arrange: (fakes) => ROUTES.setup.fail(fakes, reauthenticationRequired()),
    check: (response) => {
      expectReauthenticationRequired(response);
      expectNoStore(response);
    },
  },
  defectCase(ROUTES.setup),
  ...commonCases(ROUTES.setup),

  // POST .../authenticator-app/setup/confirmation
  {
    name: `${ROUTES.confirmation.label} confirms the app and answers the backup codes, once`,
    ...ROUTES.confirmation.request,
    arrange: ({ identity }) => identity.confirmAuthenticatorAppSetup.mockResolvedValue(CONFIGURED),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(CONFIGURED);
      expect(identity.confirmAuthenticatorAppSetup).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        code: CODE,
        client: CLIENT,
      });
    },
  },
  {
    name: `${ROUTES.confirmation.label} answers backupCodes null for a reconfiguration`,
    ...ROUTES.confirmation.request,
    arrange: ({ identity }) =>
      identity.confirmAuthenticatorAppSetup.mockResolvedValue({
        twoStepVerification: STATE,
        backupCodes: null,
      }),
    status: 200,
    check: (response) => {
      expect(response.body).toEqual({ twoStepVerification: STATE, backupCodes: null });
    },
  },
  {
    name: `${ROUTES.confirmation.label} refuses a code that is not 6 digits before identity-service`,
    ...ROUTES.confirmation.request,
    body: { code: '2618' },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.confirmAuthenticatorAppSetup).not.toHaveBeenCalled();
    },
  },
  relayed(ROUTES.confirmation, 400, 'request.invalid', {
    issues: [{ in: 'body', path: 'code', code: 'invalid_format', message: 'Invalid' }],
  }),
  relayed(ROUTES.confirmation, 422, 'auth.two-step-setup-expired', {}, (response) => {
    expect(response.body).toMatchObject({ title: 'La configuration a expiré : recommencez.' });
  }),
  relayed(ROUTES.confirmation, 422, 'auth.two-step-code-invalid', {}, (response) => {
    expect(response.body).toMatchObject({ title: 'Code incorrect ou déjà utilisé.' });
  }),
  ...commonCases(ROUTES.confirmation),

  // POST .../backup-codes/regenerate
  {
    name: `${ROUTES.regenerate.label} answers the new backup codes, once`,
    ...ROUTES.regenerate.request,
    arrange: ({ identity }) => identity.regenerateBackupCodes.mockResolvedValue(BACKUP_CODES),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(BACKUP_CODES);
      expectNoStore(response);
      expect(identity.regenerateBackupCodes).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        client: CLIENT,
      });
    },
  },
  strictBodyCase(ROUTES.regenerate),
  relayed(ROUTES.regenerate, 409, 'auth.two-step-not-enabled', {}, (response) => {
    expect(response.body).toMatchObject({
      title: 'Activez d’abord la vérification en deux étapes.',
    });
  }),
  {
    ...relayed(ROUTES.regenerate, 403, 'auth.reauthentication-required'),
    arrange: (fakes) => ROUTES.regenerate.fail(fakes, reauthenticationRequired()),
    check: expectReauthenticationRequired,
  },
  defectCase(ROUTES.regenerate),
  ...commonCases(ROUTES.regenerate),

  // POST .../security-keys/registration
  {
    name: `${ROUTES.registration.label} answers the creation options whole, unlisted members included`,
    ...ROUTES.registration.request,
    arrange: ({ identity }) =>
      identity.startSecurityKeyRegistration.mockResolvedValue(REGISTRATION),
    status: 200,
    check: (response, { identity }) => {
      expect(response.body).toEqual(REGISTRATION);
      expect(response.body).toMatchObject({
        options: {
          attestation: 'none',
          authenticatorSelection: { residentKey: 'preferred' },
          hints: ['security-key'],
        },
      });
      expect(identity.startSecurityKeyRegistration).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
      });
    },
  },
  strictBodyCase(ROUTES.registration),
  relayed(ROUTES.registration, 409, 'auth.two-step-not-enabled'),
  relayed(
    ROUTES.registration,
    409,
    'auth.security-key-limit-reached',
    { maxSecurityKeys: 10 },
    (response) => {
      expect(response.body).toMatchObject({
        title:
          'Nombre maximal de clés de sécurité atteint : retirez-en une pour en ajouter une autre.',
      });
    },
  ),
  {
    ...relayed(ROUTES.registration, 403, 'auth.reauthentication-required'),
    arrange: (fakes) => ROUTES.registration.fail(fakes, reauthenticationRequired()),
    check: expectReauthenticationRequired,
  },
  defectCase(ROUTES.registration),
  ...commonCases(ROUTES.registration),

  // POST .../security-keys
  {
    name: `${ROUTES.addition.label} registers the key and answers 201 with its public Location`,
    ...ROUTES.addition.request,
    arrange: ({ identity }) =>
      identity.addSecurityKey.mockResolvedValue({ ...KEY, lastUsedAt: null }),
    status: 201,
    check: (response, { identity }) => {
      expect(response.headers.location).toBe(`${BASE}/security-keys/${KEY_ID}`);
      expect(response.body).toEqual({ ...KEY, lastUsedAt: null });
      expectNoStore(response);
      expect(identity.addSecurityKey).toHaveBeenCalledWith(CAMILLE.id, {
        sessionId: SESSION_ID,
        name: ADDITION.name,
        credential: CREDENTIAL,
        client: CLIENT,
      });
    },
  },
  {
    name: `${ROUTES.addition.label} refuses a name longer than 60 characters before identity-service`,
    ...ROUTES.addition.request,
    body: { ...ADDITION, name: 'k'.repeat(61) },
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.addSecurityKey).not.toHaveBeenCalled();
    },
  },
  relayed(ROUTES.addition, 400, 'request.invalid', {
    issues: [{ in: 'body', path: 'name', code: 'custom', message: 'Blank' }],
  }),
  relayed(ROUTES.addition, 409, 'auth.two-step-not-enabled'),
  relayed(ROUTES.addition, 409, 'auth.security-key-limit-reached', { maxSecurityKeys: 10 }),
  relayed(ROUTES.addition, 422, 'auth.two-step-setup-expired'),
  relayed(ROUTES.addition, 422, 'auth.security-key-refused', {}, (response) => {
    expect(response.body).toMatchObject({
      title: 'Clé de sécurité non reconnue : réessayez ou choisissez une autre méthode.',
    });
  }),
  ...commonCases(ROUTES.addition),

  // DELETE .../security-keys/{securityKeyId}
  {
    name: `${ROUTES.removal.label} removes the key of the path, as the user of the session`,
    ...ROUTES.removal.request,
    arrange: ({ identity }) => identity.removeSecurityKey.mockResolvedValue(),
    status: 204,
    check: (response, { identity }) => {
      expect(response.text).toBe('');
      expect(identity.removeSecurityKey).toHaveBeenCalledWith(CAMILLE.id, KEY_ID, {
        sessionId: SESSION_ID,
        client: CLIENT,
      });
    },
  },
  {
    name: `${ROUTES.removal.label} refuses an id that is not a UUID before identity-service`,
    ...ROUTES.removal.request,
    url: `${BASE}/security-keys/yubikey`,
    status: 400,
    code: 'request.invalid',
    check: (_response, { identity }) => {
      expect(identity.removeSecurityKey).not.toHaveBeenCalled();
    },
  },
  relayed(ROUTES.removal, 404, 'security-key.not-found', {}, (response) => {
    expect(response.body).toMatchObject({ title: 'Clé de sécurité introuvable.' });
  }),
  {
    ...relayed(ROUTES.removal, 403, 'auth.reauthentication-required'),
    arrange: (fakes) => ROUTES.removal.fail(fakes, reauthenticationRequired()),
    check: expectReauthenticationRequired,
  },
  ...commonCases(ROUTES.removal),
];

describe('routes of the two-step verification of the account', () => {
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

  it('calls identity-service as the user of the session, and counts the session', async () => {
    let context: OrganizationContext | undefined;
    identity.getTwoStepVerification.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve(STATE);
    });

    await runRouteCase(application, identity, {
      name: 'read',
      ...ROUTES.read.request,
      status: 200,
    });

    expect(context).toMatchObject({ actor: { type: 'user', id: CAMILLE.id } });
    expect(application.counter.consume).toHaveBeenCalledWith(`session:${SESSION_ID}`);
    expect(application.anonymousCounter.consume).not.toHaveBeenCalled();
  });

  it('gives a withheld organization no context, while the account routes run', async () => {
    let context: OrganizationContext | undefined;
    identity.introspect.mockResolvedValue({
      ...CAMILLE_ORGANIZATION_SESSION,
      withheldOrganization: { organizationId: ATELIER_NORD_ID, code: 'organization.mfa-required' },
    });
    identity.startAuthenticatorAppSetup.mockImplementation(() => {
      context = getOrganizationContext();
      return Promise.resolve({
        secret: SECRET,
        otpauthUri: OTPAUTH_URI,
        expiresAt: '2026-11-09T13:35:00Z',
      });
    });

    await runRouteCase(application, identity, {
      name: 'setup',
      ...ROUTES.setup.request,
      status: 200,
    });

    expect(context).toMatchObject({ organizationId: null, role: null });
  });

  it('writes no secret, code or WebAuthn payload into the logs, whatever the outcome', async () => {
    application.logLines.length = 0;
    identity.startAuthenticatorAppSetup.mockResolvedValueOnce({
      secret: SECRET,
      otpauthUri: OTPAUTH_URI,
      expiresAt: '2026-11-09T13:35:00Z',
    });
    identity.confirmAuthenticatorAppSetup
      .mockResolvedValueOnce(CONFIGURED)
      .mockRejectedValueOnce(identityProblem(422, 'auth.two-step-code-invalid'));
    identity.regenerateBackupCodes.mockResolvedValueOnce(BACKUP_CODES);
    identity.startSecurityKeyRegistration.mockResolvedValueOnce(REGISTRATION);
    identity.addSecurityKey
      .mockResolvedValueOnce({ ...KEY, lastUsedAt: null })
      .mockRejectedValueOnce(identityProblem(422, 'auth.security-key-refused'));

    await runRouteCase(application, identity, { name: 's', ...ROUTES.setup.request, status: 200 });
    await runRouteCase(application, identity, {
      name: 'c',
      ...ROUTES.confirmation.request,
      status: 200,
    });
    await runRouteCase(application, identity, {
      name: 'c',
      ...ROUTES.confirmation.request,
      status: 422,
    });
    await runRouteCase(application, identity, {
      name: 'r',
      ...ROUTES.regenerate.request,
      status: 200,
    });
    await runRouteCase(application, identity, {
      name: 'k',
      ...ROUTES.registration.request,
      status: 200,
    });
    await runRouteCase(application, identity, {
      name: 'a',
      ...ROUTES.addition.request,
      status: 201,
    });
    await runRouteCase(application, identity, {
      name: 'a',
      ...ROUTES.addition.request,
      status: 422,
    });

    const logs: string = application.logLines.join('\n');
    expect(application.logLines.length).toBeGreaterThan(0);
    for (const secret of [
      SECRET,
      'otpauth://',
      CODE,
      ...CODES,
      'SecretClientDataJsonOfTheBrowser',
      'SecretAttestationObjectOfTheKey',
      'ExampleOnlyWebAuthnChallenge',
      'ExampleOnlyWebAuthnUserHandle',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });
});
