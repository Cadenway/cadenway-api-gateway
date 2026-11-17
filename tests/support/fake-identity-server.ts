import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { User } from '@cadenway/contracts/types/internal/identity-service';
import {
  InternalTokenVerifier,
  type Ed25519PublicJwk,
  type InternalActorType,
  type InternalPrincipal,
} from '@cadenway/nest-common';

/**
 * A call the fake identity-service received, with the verified internal token.
 */
export interface IdentityCall {
  readonly method: string;
  readonly path: string;
  readonly principal: InternalPrincipal;
}

/**
 * A session the fake issued.
 */
interface FakeSession {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: string;
  revoked: boolean;
  /** When its person last proved who they are in it, in milliseconds; 0 for never. */
  authenticatedAt: number;
}

/**
 * The window of recent authentication of identity-service, in milliseconds.
 */
const RECENT_AUTHENTICATION_MS = 10 * 60 * 1000;

/**
 * A fake identity-service over HTTP, from `openapi/internal/identity-service.yaml`: the sign-in by
 * password, the introspection, the revocation and the reading of an account, and the security of
 * the account (password reset, re-authentication, password change, change of address, deletion,
 * sessions). It verifies the internal token of every call as identity-service does
 * (`aud: identity-service`, issuer `api-gateway` and its public key), refuses an actor the route
 * does not accept, and answers `404 session.not-found` for a session that is not an open session
 * of the actor.
 */
export class FakeIdentityServer {
  /** Every call received, in order. */
  public readonly calls: IdentityCall[] = [];

  /** Every body received, in order, to check what the gateway sends. */
  public readonly bodies: Record<string, unknown>[] = [];

  /** Every session token issued, to check that none reaches a log line. */
  public readonly issuedTokens: string[] = [];

  /** Introspections still to answer with 503 before answering normally. */
  public failingIntrospections = 0;

  /** Active personal API tokens, by secret: the answer of their introspection. */
  public readonly apiTokens = new Map<string, Record<string, unknown>>();

  /** The token of the one usable reset link, issued by the last reset request. */
  public resetToken: string | undefined;

  /** The code of the pending change of address, issued by the last request. */
  public emailChangeCode: string | undefined;

  private readonly sessions = new Map<string, FakeSession>();
  private readonly server: Server;
  private password: string;
  private email: string;
  private pendingEmail: string | undefined;
  private passwordChangedAt: string | undefined;

  private constructor(
    private readonly verifier: InternalTokenVerifier,
    private readonly user: User,
    password: string,
  ) {
    this.password = password;
    this.email = user.email;
    this.server = createServer((request: IncomingMessage, response: ServerResponse) => {
      void this.handle(request, response);
    });
  }

  /**
   * Starts the fake on a free loopback port.
   *
   * @param gatewayKey - Public key of the gateway's signing key.
   * @param user - The one account.
   * @param password - Its password.
   * @returns The listening fake.
   */
  public static async start(
    gatewayKey: Ed25519PublicJwk,
    user: User,
    password: string,
  ): Promise<FakeIdentityServer> {
    const verifier: InternalTokenVerifier = await InternalTokenVerifier.create({
      audience: 'identity-service',
      trustedIssuers: { 'api-gateway': [gatewayKey] },
    });
    const fake: FakeIdentityServer = new FakeIdentityServer(verifier, user, password);
    await new Promise<void>((resolve) => fake.server.listen(0, '127.0.0.1', resolve));
    return fake;
  }

  /** Base URL, for `IDENTITY_SERVICE_URL`. */
  public get url(): string {
    return `http://127.0.0.1:${String((this.server.address() as AddressInfo).port)}`;
  }

  /**
   * Revokes every session of the account, as another device would.
   */
  public revokeAll(): void {
    for (const session of this.sessions.values()) {
      session.revoked = true;
    }
  }

  /**
   * Ends the window of recent authentication of every session, as 10 minutes would.
   */
  public forgetRecentAuthentications(): void {
    for (const session of this.sessions.values()) {
      session.authenticatedAt = 0;
    }
  }

  /**
   * Counts the open sessions of the account.
   *
   * @returns The count.
   */
  public openSessionCount(): number {
    return [...this.sessions.values()].filter((session) => !session.revoked).length;
  }

  /**
   * Lists the actor of each call to a route.
   *
   * @param method - Method of the route.
   * @param path - Path, or its prefix.
   * @returns The actor types.
   */
  public actorsOf(method: string, path: string): InternalActorType[] {
    return this.calls
      .filter((call) => call.method === method && call.path.startsWith(path))
      .map((call) => call.principal.actor.type);
  }

  /**
   * Stops the fake.
   */
  public async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => {
        if (error === undefined) {
          resolve();
        } else {
          reject(error);
        }
      }),
    );
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method: string = request.method ?? 'GET';
    const path: string = request.url ?? '/';
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(chunk as Buffer);
    }
    const body: Record<string, unknown> =
      chunks.length === 0
        ? {}
        : (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
    this.bodies.push(body);
    let principal: InternalPrincipal;
    try {
      principal = await this.verifier.verify(
        (request.headers.authorization ?? '').replace(/^Bearer /u, ''),
      );
    } catch {
      this.problem(response, 401, 'auth.token-invalid');
      return;
    }
    this.calls.push({ method, path, principal });
    const actor: InternalActorType = principal.actor.type;

    if (method === 'POST' && path === '/internal/v1/auth/sign-in') {
      if (actor !== 'anonymous') {
        this.problem(response, 403, 'auth.actor-not-allowed');
      } else if (body.email !== this.email || body.password !== this.password) {
        this.problem(response, 422, 'auth.invalid-credentials', { remainingAttempts: 4 });
      } else {
        const token: string = randomBytes(32).toString('base64url');
        const session: FakeSession = {
          id: randomUUID(),
          userId: this.user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          revoked: false,
          authenticatedAt: Date.now(),
        };
        this.sessions.set(token, session);
        this.issuedTokens.push(token);
        this.json(response, 200, {
          token,
          session: {
            id: session.id,
            expiresAt: session.expiresAt,
            persistent: body.rememberMe === true,
          },
          user: this.account(),
        });
      }
      return;
    }
    if (method === 'POST' && path === '/internal/v1/tokens/introspect') {
      if (actor !== 'system') {
        this.problem(response, 403, 'auth.actor-not-allowed');
        return;
      }
      if (this.failingIntrospections > 0) {
        this.failingIntrospections -= 1;
        response.writeHead(503).end();
        return;
      }
      const session: FakeSession | undefined =
        typeof body.token === 'string' ? this.sessions.get(body.token) : undefined;
      this.json(
        response,
        200,
        session === undefined || session.revoked
          ? { active: false }
          : {
              active: true,
              tokenType: 'session',
              sessionId: session.id,
              userId: session.userId,
              organizationId: null,
              role: null,
              scopes: ['tasks:read', 'tasks:write', 'members:read', 'webhooks:manage'],
              expiresAt: session.expiresAt,
            },
      );
      return;
    }
    if (method === 'POST' && path === '/internal/v1/api-tokens/introspect') {
      if (actor !== 'system') {
        this.problem(response, 403, 'auth.actor-not-allowed');
        return;
      }
      const token: Record<string, unknown> | undefined =
        typeof body.token === 'string' ? this.apiTokens.get(body.token) : undefined;
      this.json(response, 200, token ?? { active: false });
      return;
    }
    const revoke: RegExpExecArray | null = /^\/internal\/v1\/sessions\/([^/]+)$/u.exec(path);
    if (method === 'DELETE' && revoke !== null) {
      const session: FakeSession | undefined = [...this.sessions.values()].find(
        (candidate) => candidate.id === revoke[1],
      );
      if (actor !== 'user') {
        this.problem(response, 403, 'auth.actor-not-allowed');
      } else if (session?.userId !== principal.actor.id) {
        this.problem(response, 404, 'session.not-found');
      } else {
        session.revoked = true;
        response.writeHead(204).end();
      }
      return;
    }
    const read: RegExpExecArray | null = /^\/internal\/v1\/users\/([^/]+)$/u.exec(path);
    if (method === 'GET' && read !== null) {
      if (actor !== 'user') {
        this.problem(response, 403, 'auth.actor-not-allowed');
      } else if (read[1] !== principal.actor.id || read[1] !== this.user.id) {
        this.problem(response, 404, 'user.not-found');
      } else {
        this.json(response, 200, this.account());
      }
      return;
    }
    if (this.handlePasswordReset(method, path, body, actor, response)) {
      return;
    }
    if (this.handleAccountSecurity(method, path, body, principal, response)) {
      return;
    }
    this.problem(response, 404, 'http.not-found');
  }

  /**
   * The account as identity-service answers it, with its current address and, once the password
   * changed, when.
   *
   * @returns The account.
   */
  private account(): User {
    return {
      ...this.user,
      email: this.email,
      ...(this.passwordChangedAt === undefined
        ? {}
        : { passwordChangedAt: this.passwordChangedAt }),
    };
  }

  /**
   * Finds an open session of the actor.
   *
   * @param id - Id of the session.
   * @param principal - The verified internal token.
   * @returns The session, or `undefined` when it is not an open session of the actor.
   */
  private openSessionOf(id: unknown, principal: InternalPrincipal): FakeSession | undefined {
    const session: FakeSession | undefined = [...this.sessions.values()].find(
      (candidate) => candidate.id === id,
    );
    return session !== undefined && !session.revoked && session.userId === principal.actor.id
      ? session
      : undefined;
  }

  /**
   * Serves the password reset, as the actor `anonymous`.
   *
   * @param method - Method of the call.
   * @param path - Path of the call.
   * @param body - Parsed body.
   * @param actor - Actor of the internal token.
   * @param response - Response to write.
   * @returns `true` when the call was one of the reset routes.
   */
  private handlePasswordReset(
    method: string,
    path: string,
    body: Record<string, unknown>,
    actor: InternalActorType,
    response: ServerResponse,
  ): boolean {
    if (method !== 'POST' || !path.startsWith('/internal/v1/auth/password-reset')) {
      return false;
    }
    if (actor !== 'anonymous') {
      this.problem(response, 403, 'auth.actor-not-allowed');
      return true;
    }
    const expiresAt: string = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    if (path === '/internal/v1/auth/password-reset') {
      if (body.email === this.email) {
        this.resetToken = randomBytes(32).toString('base64url');
      }
      this.json(response, 202, {
        email: body.email,
        expiresAt,
        resendAvailableAt: new Date(Date.now() + 45 * 1000).toISOString(),
      });
      return true;
    }
    if (this.resetToken === undefined || body.token !== this.resetToken) {
      this.problem(response, 422, 'auth.reset-link-expired');
      return true;
    }
    if (path === '/internal/v1/auth/password-reset/inspection') {
      this.json(response, 200, {
        email: this.email,
        expiresAt,
        sessionCount: this.openSessionCount(),
      });
      return true;
    }
    if (path === '/internal/v1/auth/password-reset/confirmation') {
      this.resetToken = undefined;
      this.password = String(body.newPassword);
      this.passwordChangedAt = new Date().toISOString();
      const closed: number = body.closeOtherSessions === false ? 0 : this.openSessionCount();
      if (body.closeOtherSessions !== false) {
        this.revokeAll();
      }
      this.json(response, 200, { email: this.email, closedSessionCount: closed });
      return true;
    }
    return false;
  }

  /**
   * Serves the routes of the signed-in person about the security of the account, as the actor
   * `user`, for the session the gateway names (path, body `sessionId` or query
   * `currentSessionId`).
   *
   * @param method - Method of the call.
   * @param path - Path of the call, with its query.
   * @param body - Parsed body.
   * @param principal - The verified internal token.
   * @param response - Response to write.
   * @returns `true` when the call was one of these routes.
   */
  private handleAccountSecurity(
    method: string,
    path: string,
    body: Record<string, unknown>,
    principal: InternalPrincipal,
    response: ServerResponse,
  ): boolean {
    const url: URL = new URL(path, 'http://identity-service');
    const sessionRoute: RegExpExecArray | null =
      /^\/internal\/v1\/sessions\/([^/]+)\/(reauthentication|revoke-others)$/u.exec(url.pathname);
    const userRoute: RegExpExecArray | null =
      /^\/internal\/v1\/users\/([^/]+)\/(password|email-change|email-change\/confirmation|deletion|sessions)$/u.exec(
        url.pathname,
      );
    if (sessionRoute === null && userRoute === null) {
      return false;
    }
    if (principal.actor.type !== 'user') {
      this.problem(response, 403, 'auth.actor-not-allowed');
      return true;
    }
    if (userRoute !== null && userRoute[1] !== principal.actor.id) {
      this.problem(response, 404, 'user.not-found');
      return true;
    }
    const sessionId: unknown =
      sessionRoute?.[1] ??
      (userRoute?.[2] === 'sessions' ? url.searchParams.get('currentSessionId') : body.sessionId);
    const session: FakeSession | undefined = this.openSessionOf(sessionId, principal);
    if (session === undefined) {
      this.problem(response, 404, 'session.not-found');
      return true;
    }
    const recent: boolean = Date.now() - session.authenticatedAt < RECENT_AUTHENTICATION_MS;
    const route = `${method} ${sessionRoute?.[2] ?? userRoute?.[2] ?? ''}`;
    switch (route) {
      case 'POST reauthentication':
        return this.reauthenticate(session, body, response);
      case 'POST revoke-others':
        return this.revokeOthers(session, response);
      case 'PUT password':
        if (body.currentPassword !== this.password) {
          this.problem(response, 422, 'auth.password-incorrect', { remainingAttempts: 4 });
          return true;
        }
        this.password = String(body.newPassword);
        this.passwordChangedAt = new Date().toISOString();
        session.authenticatedAt = Date.now();
        this.json(response, 200, this.account());
        return true;
      case 'POST email-change':
        if (!recent) {
          this.problem(response, 403, 'auth.reauthentication-required', { methods: ['password'] });
          return true;
        }
        this.pendingEmail = String(body.email);
        this.emailChangeCode = '731406';
        this.json(response, 202, {
          email: this.pendingEmail,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          resendAvailableAt: new Date(Date.now() + 30 * 1000).toISOString(),
        });
        return true;
      case 'POST email-change/confirmation':
        if (this.pendingEmail === undefined || body.code !== this.emailChangeCode) {
          this.problem(response, 422, 'auth.code-invalid');
          return true;
        }
        this.email = this.pendingEmail;
        this.pendingEmail = undefined;
        this.json(response, 200, this.account());
        return true;
      case 'POST deletion':
        if (!recent) {
          this.problem(response, 403, 'auth.reauthentication-required', { methods: ['password'] });
          return true;
        }
        this.revokeAll();
        this.json(response, 202, {
          deleteAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        });
        return true;
      case 'GET sessions':
        this.json(response, 200, { items: this.openSessions(session), nextCursor: null });
        return true;
      default:
        return false;
    }
  }

  /**
   * Checks the password in a session and opens its window of recent authentication.
   *
   * @param session - The session of the request.
   * @param body - Parsed body.
   * @param response - Response to write.
   * @returns `true`.
   */
  private reauthenticate(
    session: FakeSession,
    body: Record<string, unknown>,
    response: ServerResponse,
  ): boolean {
    if (body.password !== this.password) {
      this.problem(response, 422, 'auth.password-incorrect', { remainingAttempts: 4 });
      return true;
    }
    session.authenticatedAt = Date.now();
    this.json(response, 200, {
      authenticatedAt: new Date(session.authenticatedAt).toISOString(),
      expiresAt: new Date(session.authenticatedAt + RECENT_AUTHENTICATION_MS).toISOString(),
    });
    return true;
  }

  /**
   * Revokes every open session but one.
   *
   * @param session - The session kept.
   * @param response - Response to write.
   * @returns `true`.
   */
  private revokeOthers(session: FakeSession, response: ServerResponse): boolean {
    let revokedCount = 0;
    for (const other of this.sessions.values()) {
      if (other !== session && !other.revoked) {
        other.revoked = true;
        revokedCount += 1;
      }
    }
    this.json(response, 200, { revokedCount });
    return true;
  }

  /**
   * Lists the open sessions, as the internal contract describes them.
   *
   * @param current - The session of the request.
   * @returns The sessions.
   */
  private openSessions(current: FakeSession): Record<string, unknown>[] {
    return [...this.sessions.values()]
      .filter((candidate) => !candidate.revoked)
      .map((candidate) => ({
        id: candidate.id,
        current: candidate === current,
        device: {
          type: 'desktop',
          browser: 'Firefox',
          browserVersion: '145',
          os: 'Windows',
          osVersion: null,
        },
        ipAddress: '127.0.0.1',
        signedInAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        expiresAt: candidate.expiresAt,
      }));
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  }

  private problem(
    response: ServerResponse,
    status: number,
    code: string,
    details?: Record<string, unknown>,
  ): void {
    response.writeHead(status, { 'Content-Type': 'application/problem+json' }).end(
      JSON.stringify({
        type: 'about:blank',
        title: 'Internal title',
        status,
        code,
        ...(details === undefined ? {} : { details }),
      }),
    );
  }
}
