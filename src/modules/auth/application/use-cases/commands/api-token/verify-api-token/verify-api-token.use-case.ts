import type { VerifyApiTokenInput } from './verify-api-token.input.js';
import type { VerifyApiTokenOutput } from './verify-api-token.output.js';
import type { VerifiedApiToken } from '../../../../models/api-token/verified-api-token.model.js';
import type { ApiTokenIntrospector } from '../../../../ports/outbound/identity/api-token/api-token-introspector.port.js';
import type { BearerFailureLimit } from '../../../../ports/outbound/rate-limit/api-token/bearer-failure-limit.port.js';

/**
 * Class VerifyApiToken
 *
 * @description
 * Verifies the bearer token of a request through the gateway-owned Identity port, without a
 * cache, within the limit of 10 failed bearer-token authentications per minute per client
 * address:
 *
 * 1. An address that used its failures of the window is `throttled` before anything else: its
 *    token, valid or not, is not introspected until the window ends.
 * 2. A malformed token is `invalid` without a call; another is introspected, and is `invalid`
 *    when identity-service does not find it active. Either failure is counted on the address.
 * 3. An active token is `verified` and counts nothing.
 *
 * A failed introspection propagates and counts nothing: it says nothing about the token.
 */
export class VerifyApiToken {
  // #region Properties
  /**
   * Property introspector
   *
   * @description
   * Port for verifying personal API tokens.
   *
   * @type {ApiTokenIntrospector}
   * @readonly
   */
  private readonly introspector: ApiTokenIntrospector;

  /**
   * Property failures
   *
   * @description
   * The limit of the failed bearer-token authentications of a client address.
   *
   * @type {BearerFailureLimit}
   * @readonly
   */
  private readonly failures: BearerFailureLimit;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the verification and limit ports.
   *
   * @param {ApiTokenIntrospector} introspector - Verifies a personal API token through Identity.
   * @param {BearerFailureLimit} failures - Limits the failed bearer authentications of an address.
   * @constructor
   */
  public constructor(introspector: ApiTokenIntrospector, failures: BearerFailureLimit) {
    this.introspector = introspector;
    this.failures = failures;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Verifies the bearer token of the current request.
   *
   * @param {VerifyApiTokenInput} input - The token, `null` when malformed, and the client address.
   * @returns {Promise<VerifyApiTokenOutput>} `verified`, `invalid` or `throttled`.
   * @throws {ProblemException} 503 `upstream.*` when identity-service cannot answer.
   */
  public async execute(input: VerifyApiTokenInput): Promise<VerifyApiTokenOutput> {
    const retryAfterSeconds: number = await this.failures.secondsUntilAllowed(input.clientAddress);
    if (retryAfterSeconds > 0) {
      return { outcome: 'throttled', retryAfterSeconds };
    }
    const token: VerifiedApiToken | null =
      input.token === null ? null : await this.introspector.introspect(input.token);
    if (token === null) {
      await this.failures.countFailure(input.clientAddress);
      return { outcome: 'invalid' };
    }
    return { outcome: 'verified', token };
  }
  // #endregion
}
