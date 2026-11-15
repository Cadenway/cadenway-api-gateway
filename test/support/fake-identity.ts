import type {
  CodeRequest,
  CodeSent,
  CodeVerification,
  PasswordSignIn,
  SessionIssued,
  SignInMethods,
  SignInMethodsRequest,
  SignUpRequest,
  User,
} from '@cadenway/contracts/types/internal/identity-service';
import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { vi, type Mock } from 'vitest';

import {
  SESSION_INTROSPECTOR,
  type SessionIntrospector,
} from '../../src/auth/session-introspector.port.js';
import type { VerifiedSession } from '../../src/auth/verified-session.js';
import { IDENTITY_AUTH, type IdentityAuth } from '../../src/routes/auth/identity-auth.port.js';
import { IDENTITY_USERS, type IdentityUsers } from '../../src/routes/me/identity-users.port.js';

/**
 * Account of the mockup, as identity-service returns it.
 */
export const CAMILLE: User = {
  id: '019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30',
  name: 'Camille Martin',
  email: 'camille.martin@ateliernord.fr',
  language: 'fr',
  version: 2,
};

/**
 * Active session of Camille, as the introspection returns it.
 */
export const CAMILLE_SESSION: VerifiedSession = {
  sessionId: '019a6a2e-4b1c-7d3e-8f5a-2c9b7e1d4a60',
  userId: CAMILLE.id,
  organizationId: null,
  role: null,
  scopes: [],
  expiresAt: '2026-12-08T13:07:00Z',
};

/**
 * Token of Camille's session cookie in the tests.
 */
export const CAMILLE_TOKEN = 'f4Kx9-session-token-of-camille';

/**
 * The fake of identity-service behind the three ports, one mock per internal route.
 */
export interface FakeIdentity extends SessionIntrospector, IdentityAuth, IdentityUsers {
  readonly introspect: Mock<SessionIntrospector['introspect']>;
  readonly discoverSignInMethods: Mock<(request: SignInMethodsRequest) => Promise<SignInMethods>>;
  readonly signUp: Mock<(request: SignUpRequest) => Promise<CodeSent>>;
  readonly resendSignUpCode: Mock<(request: CodeRequest) => Promise<CodeSent>>;
  readonly verifySignUp: Mock<(request: CodeVerification) => Promise<SessionIssued>>;
  readonly signInWithPassword: Mock<(request: PasswordSignIn) => Promise<SessionIssued>>;
  readonly requestSignInCode: Mock<(request: CodeRequest) => Promise<CodeSent>>;
  readonly signInWithCode: Mock<(request: CodeVerification) => Promise<SessionIssued>>;
  readonly revokeSession: Mock<(sessionId: string) => Promise<void>>;
  readonly getUser: Mock<(userId: string) => Promise<User>>;
}

/**
 * Builds a fake whose introspection knows Camille's token only and whose other routes fail until a
 * test gives them an answer.
 *
 * @returns The fake.
 */
export function createFakeIdentity(): FakeIdentity {
  const unexpected = (): Promise<never> => Promise.reject(new Error('Unexpected call.'));
  return {
    introspect: vi.fn((token: string) =>
      Promise.resolve(token === CAMILLE_TOKEN ? CAMILLE_SESSION : null),
    ),
    discoverSignInMethods: vi.fn(unexpected),
    signUp: vi.fn(unexpected),
    resendSignUpCode: vi.fn(unexpected),
    verifySignUp: vi.fn(unexpected),
    signInWithPassword: vi.fn(unexpected),
    requestSignInCode: vi.fn(unexpected),
    signInWithCode: vi.fn(unexpected),
    revokeSession: vi.fn(unexpected),
    getUser: vi.fn(unexpected),
  };
}

/**
 * Builds what the internal HTTP client throws for a client error of identity-service: the status,
 * code and details of its problem, its English title, and `details.service`.
 *
 * @param status - Status identity-service answered.
 * @param code - Code of its problem.
 * @param details - Details of its problem.
 * @returns The problem.
 */
export function identityProblem(
  status: ProblemStatus,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ProblemException {
  return new ProblemException({
    status,
    code,
    detail: 'Internal wording that never reaches the browser.',
    details: { ...details, service: 'identity-service' },
  });
}

/**
 * Builds what the internal HTTP client throws when identity-service cannot answer.
 *
 * @param reason - Last part of the `upstream.*` code.
 * @returns The problem.
 */
export function identityUnavailable(reason = 'unavailable'): ProblemException {
  return new ProblemException({
    status: 503,
    code: `upstream.${reason}`,
    detail: 'A service this request depends on is not available.',
    details: { service: 'identity-service' },
  });
}

/**
 * Empty module the fake ports are provided from.
 */
@Global()
@Module({})
class FakeIdentityModule {}

/**
 * Provides the fake globally under the tokens `ClientsModule` provides, as the route tests replace
 * the clients of the internal services.
 *
 * @param fake - The fake of identity-service.
 * @returns The global module.
 */
export function fakeIdentityModule(fake: FakeIdentity): DynamicModule {
  return {
    module: FakeIdentityModule,
    global: true,
    providers: [
      { provide: SESSION_INTROSPECTOR, useValue: fake },
      { provide: IDENTITY_AUTH, useValue: fake },
      { provide: IDENTITY_USERS, useValue: fake },
    ],
    exports: [SESSION_INTROSPECTOR, IDENTITY_AUTH, IDENTITY_USERS],
  };
}
