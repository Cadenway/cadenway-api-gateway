/**
 * Constant OPERATION_SECURITY
 *
 * @description
 * Metadata key under which a route handler carries the `OperationSecurity` of its public
 * operation, set by `CredentialGuard.requires`.
 *
 * @type {string}
 */
export const OPERATION_SECURITY: string = 'cadenway:operation-security';

/**
 * Constant SESSION_SCHEME
 *
 * @description
 * Name of the security scheme of the session cookie in the public contracts.
 *
 * @type {string}
 */
export const SESSION_SCHEME: string = 'sessionCookie';

/**
 * Constant API_TOKEN_SCHEME
 *
 * @description
 * Name of the security scheme of a personal API token in the public contracts.
 *
 * @type {string}
 */
export const API_TOKEN_SCHEME: string = 'apiToken';

/**
 * Interface OperationSecurity
 *
 * @description
 * What a public operation of `openapi/public/` lets call it, copied from its contract: the
 * `security` of the operation as written there, and whether it acts on the current organization.
 * A route test (`operation-security.validation.spec.ts`) checks every handler of the gateway
 * against the shipped contracts, so the copy cannot drift from the specs.
 *
 * - `security: []`: no credential; the guard reads neither the cookie nor a bearer token.
 * - `{ sessionCookie: [] }`: the session cookie; a session holds every scope.
 * - `{ apiToken: [<scope>, ...] }`: a personal API token holding every listed scope.
 * - `{}`: the credential is optional (the sign-out); a bearer token is then ignored.
 */
export interface OperationSecurity {
  // #region Properties
  /**
   * Property operationId
   *
   * @description
   * `operationId` of the public operation the handler serves.
   *
   * @type {string}
   * @readonly
   */
  readonly operationId: string;

  /**
   * Property security
   *
   * @description
   * The security requirements of the operation, alternatives of which one must hold.
   *
   * @type {readonly Readonly<Record<string, readonly string[]>>[]}
   * @readonly
   */
  readonly security: readonly Readonly<Record<string, readonly string[]>>[];

  /**
   * Property organization
   *
   * @description
   * `true` when the operation acts on the current organization: a session without one answers
   * `403 organization.not-selected` before any call. A personal API token always has one.
   *
   * @type {boolean}
   * @readonly
   */
  readonly organization: boolean;
  // #endregion
}

/**
 * Function needsCredential
 *
 * @description
 * Tells whether an operation reads a credential at all.
 *
 * @param {OperationSecurity} operation - Security of the operation.
 * @returns {boolean} `false` for `security: []`.
 */
export function needsCredential(operation: OperationSecurity): boolean {
  return operation.security.length > 0;
}

/**
 * Function credentialIsOptional
 *
 * @description
 * Tells whether an operation also runs without a credential (an empty requirement `{}` among its
 * alternatives, as the sign-out declares).
 *
 * @param {OperationSecurity} operation - Security of the operation.
 * @returns {boolean} `true` when the credential is optional.
 */
export function credentialIsOptional(operation: OperationSecurity): boolean {
  return operation.security.some(
    (requirement: Readonly<Record<string, readonly string[]>>) =>
      Object.keys(requirement).length === 0,
  );
}

/**
 * Function acceptsSession
 *
 * @description
 * Tells whether an operation accepts the session cookie.
 *
 * @param {OperationSecurity} operation - Security of the operation.
 * @returns {boolean} `true` when an alternative names `sessionCookie`.
 */
export function acceptsSession(operation: OperationSecurity): boolean {
  return operation.security.some((requirement: Readonly<Record<string, readonly string[]>>) =>
    Object.hasOwn(requirement, SESSION_SCHEME),
  );
}

/**
 * Function apiTokenScopesOf
 *
 * @description
 * The scopes a personal API token needs on an operation.
 *
 * @param {OperationSecurity} operation - Security of the operation.
 * @returns {readonly string[] | undefined} The scopes of its `apiToken` alternative, or
 * `undefined` when the operation accepts no personal API token.
 */
export function apiTokenScopesOf(operation: OperationSecurity): readonly string[] | undefined {
  for (const requirement of operation.security) {
    if (Object.hasOwn(requirement, API_TOKEN_SCHEME)) {
      return requirement[API_TOKEN_SCHEME] ?? [];
    }
  }
  return undefined;
}
