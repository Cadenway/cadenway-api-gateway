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
}

/**
 * A fake identity-service over HTTP, from `openapi/internal/identity-service.yaml`: the sign-in by
 * password, the introspection, the revocation and the reading of an account. It verifies the
 * internal token of every call as identity-service does (`aud: identity-service`, issuer
 * `api-gateway` and its public key) and refuses an actor the route does not accept.
 */
export class FakeIdentityServer {
  /** Every call received, in order. */
  public readonly calls: IdentityCall[] = [];

  /** Every session token issued, to check that none reaches a log line. */
  public readonly issuedTokens: string[] = [];

  /** Introspections still to answer with 503 before answering normally. */
  public failingIntrospections = 0;

  /** Active personal API tokens, by secret: the answer of their introspection. */
  public readonly apiTokens = new Map<string, Record<string, unknown>>();

  private readonly sessions = new Map<string, FakeSession>();
  private readonly server: Server;

  private constructor(
    private readonly verifier: InternalTokenVerifier,
    private readonly user: User,
    private readonly password: string,
  ) {
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
      } else if (body.email !== this.user.email || body.password !== this.password) {
        this.problem(response, 422, 'auth.invalid-credentials', { remainingAttempts: 4 });
      } else {
        const token: string = randomBytes(32).toString('base64url');
        const session: FakeSession = {
          id: randomUUID(),
          userId: this.user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          revoked: false,
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
          user: this.user,
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
        this.json(response, 200, this.user);
      }
      return;
    }
    this.problem(response, 404, 'http.not-found');
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
