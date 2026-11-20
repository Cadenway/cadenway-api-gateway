import type { User } from '@cadenway/contracts/types/internal/identity-service';
import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import { vi, type Mock } from 'vitest';

import type { IdentityServiceClient } from '../../src/clients/identity-service.client.js';

/**
 * An active session, as the identity-service client answers its introspection.
 */
export type IntrospectedSession = NonNullable<
  Awaited<ReturnType<IdentityServiceClient['introspect']>>
>;

/**
 * An active personal API token, as the identity-service client answers its introspection.
 */
export type IntrospectedApiToken = NonNullable<
  Awaited<ReturnType<IdentityServiceClient['introspectApiToken']>>
>;

/**
 * Every scope a session holds, as the introspection lists them.
 */
export const ALL_SCOPES: string[] = [
  'tasks:read',
  'tasks:write',
  'members:read',
  'webhooks:manage',
];

/**
 * Id of the organization of the mockup, Atelier Nord.
 */
export const ATELIER_NORD_ID = '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b2f';

/**
 * Account of the mockup, as identity-service returns it.
 */
export const CAMILLE: User = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
  displayName: null,
  jobTitle: null,
  timeZone: 'Europe/Paris',
  version: 2,
};

/**
 * Active session of Camille without a current organization, as the introspection returns it.
 */
export const CAMILLE_SESSION: IntrospectedSession = {
  sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
  userId: CAMILLE.id,
  organizationId: null,
  role: null,
  scopes: ALL_SCOPES,
  expiresAt: '2026-12-08T13:07:00Z',
};

/**
 * Token of Camille's session cookie without a current organization in the tests.
 */
export const CAMILLE_TOKEN = 'f4Kx9-session-token-of-camille';

/**
 * Active session of Camille in Atelier Nord, of which she is the owner.
 */
export const CAMILLE_ORGANIZATION_SESSION: IntrospectedSession = {
  sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a61',
  userId: CAMILLE.id,
  organizationId: ATELIER_NORD_ID,
  role: 'owner',
  scopes: ALL_SCOPES,
  expiresAt: '2026-12-08T13:07:00Z',
};

/**
 * Token of Camille's session cookie in Atelier Nord.
 */
export const CAMILLE_ORGANIZATION_TOKEN = 'f4Kx9-session-token-of-camille-in-atelier-nord';

/**
 * Secret of Camille's personal API token with `members:read`, in the format of the contract.
 */
export const MEMBERS_TOKEN = 'cw_pat_MembersReadTokenOfCamille00000000000';

/**
 * Camille's personal API token with `members:read`, as its introspection returns it.
 */
export const MEMBERS_API_TOKEN: IntrospectedApiToken = {
  apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e90',
  userId: CAMILLE.id,
  organizationId: ATELIER_NORD_ID,
  role: 'owner',
  scopes: ['members:read'],
  expiresAt: '2026-12-08T14:02:00Z',
};

/**
 * Secret of Camille's personal API token with `tasks:read` only.
 */
export const TASKS_TOKEN = 'cw_pat_TasksReadTokenOfCamille0000000000000';

/**
 * Camille's personal API token with `tasks:read` only, as its introspection returns it.
 */
export const TASKS_API_TOKEN: IntrospectedApiToken = {
  apiTokenId: '019a6c30-7a8b-7c9d-8e0f-1a2b3c4d5e91',
  userId: CAMILLE.id,
  organizationId: ATELIER_NORD_ID,
  role: 'owner',
  scopes: ['tasks:read'],
  expiresAt: null,
};

/**
 * Sessions the fake introspection knows, by token.
 */
const SESSIONS: ReadonlyMap<string, IntrospectedSession> = new Map<string, IntrospectedSession>([
  [CAMILLE_TOKEN, CAMILLE_SESSION],
  [CAMILLE_ORGANIZATION_TOKEN, CAMILLE_ORGANIZATION_SESSION],
]);

/**
 * Personal API tokens the fake introspection knows, by secret.
 */
const API_TOKENS: ReadonlyMap<string, IntrospectedApiToken> = new Map<string, IntrospectedApiToken>(
  [
    [MEMBERS_TOKEN, MEMBERS_API_TOKEN],
    [TASKS_TOKEN, TASKS_API_TOKEN],
  ],
);

/**
 * Public methods of the identity-service client.
 */
type IdentityMethod = {
  [K in keyof IdentityServiceClient]: IdentityServiceClient[K] extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof IdentityServiceClient];

/**
 * The fake of identity-service: one mock per method of the identity-service client, which the
 * route tests put in place of the real methods.
 */
export type FakeIdentity = {
  readonly [K in IdentityMethod]: Mock<IdentityServiceClient[K]>;
};

/**
 * Builds a fake whose introspections know the sessions and tokens of this file only and whose
 * other routes fail until a test gives them an answer.
 *
 * @returns The fake.
 */
export function createFakeIdentity(): FakeIdentity {
  const unexpected = (): Promise<never> => Promise.reject(new Error('Unexpected call.'));
  return {
    introspect: vi.fn((token: string) => Promise.resolve(SESSIONS.get(token) ?? null)),
    introspectApiToken: vi.fn((token: string) => Promise.resolve(API_TOKENS.get(token) ?? null)),
    issueRealtimeTicket: vi.fn(unexpected),
    discoverSignInMethods: vi.fn(unexpected),
    signUp: vi.fn(unexpected),
    resendSignUpCode: vi.fn(unexpected),
    verifySignUp: vi.fn(unexpected),
    signInWithPassword: vi.fn(unexpected),
    requestSignInCode: vi.fn(unexpected),
    signInWithCode: vi.fn(unexpected),
    revokeSession: vi.fn(unexpected),
    getUser: vi.fn(unexpected),
    updateUser: vi.fn(unexpected),
    switchSessionOrganization: vi.fn(unexpected),
    createApiToken: vi.fn(unexpected),
    listApiTokens: vi.fn(unexpected),
    revokeApiToken: vi.fn(unexpected),
    requestPasswordReset: vi.fn(unexpected),
    inspectPasswordResetLink: vi.fn(unexpected),
    confirmPasswordReset: vi.fn(unexpected),
    reauthenticate: vi.fn(unexpected),
    changePassword: vi.fn(unexpected),
    requestEmailChange: vi.fn(unexpected),
    confirmEmailChange: vi.fn(unexpected),
    scheduleAccountDeletion: vi.fn(unexpected),
    listUserSessions: vi.fn(unexpected),
    revokeOtherSessions: vi.fn(unexpected),
    inspectSignInChallenge: vi.fn(unexpected),
    answerSignInChallengeWithAuthenticatorApp: vi.fn(unexpected),
    answerSignInChallengeWithBackupCode: vi.fn(unexpected),
    getSignInChallengeSecurityKeyOptions: vi.fn(unexpected),
    answerSignInChallengeWithSecurityKey: vi.fn(unexpected),
    getTwoStepVerification: vi.fn(unexpected),
    disableTwoStepVerification: vi.fn(unexpected),
    startAuthenticatorAppSetup: vi.fn(unexpected),
    confirmAuthenticatorAppSetup: vi.fn(unexpected),
    regenerateBackupCodes: vi.fn(unexpected),
    startSecurityKeyRegistration: vi.fn(unexpected),
    addSecurityKey: vi.fn(unexpected),
    removeSecurityKey: vi.fn(unexpected),
    getAuthenticationPolicy: vi.fn(unexpected),
    updateAuthenticationPolicy: vi.fn(unexpected),
  };
}

/**
 * Builds what the internal HTTP client throws for a client error of an internal service: the
 * status, code and details of its problem, its English title, and `details.service`.
 *
 * @param status - Status the service answered.
 * @param code - Code of its problem.
 * @param details - Details of its problem.
 * @param service - The service; identity-service by default.
 * @returns The problem.
 */
export function identityProblem(
  status: ProblemStatus,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
  service = 'identity-service',
): ProblemException {
  return new ProblemException({
    status,
    code,
    detail: 'Internal wording that never reaches the browser.',
    details: { ...details, service },
  });
}

/**
 * Builds what the internal HTTP client throws when an internal service cannot answer.
 *
 * @param reason - Last part of the `upstream.*` code.
 * @param service - The service; identity-service by default.
 * @returns The problem.
 */
export function identityUnavailable(
  reason = 'unavailable',
  service = 'identity-service',
): ProblemException {
  return new ProblemException({
    status: 503,
    code: `upstream.${reason}`,
    detail: 'A service this request depends on is not available.',
    details: { service },
  });
}
