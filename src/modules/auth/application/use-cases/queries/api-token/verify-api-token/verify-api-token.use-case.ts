import type { VerifiedApiToken } from '../../../../models/api-token/verified-api-token.model.js';
import type { ApiTokenIntrospector } from '../../../../ports/outbound/identity/api-token/api-token-introspector.port.js';

/**
 * Class VerifyApiToken
 *
 * @description
 * Verifies each personal API token through the gateway-owned Identity port, without a cache.
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
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the verification port.
   *
   * @param {ApiTokenIntrospector} introspector - Verifies a personal API token through Identity.
   * @constructor
   */
  public constructor(introspector: ApiTokenIntrospector) {
    this.introspector = introspector;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Requests verification of the bearer token of the current request.
   *
   * @param {string} token - Candidate token, which must stay out of logs.
   * @returns {Promise<VerifiedApiToken | null>} Active token, or null when inactive.
   */
  public execute(token: string): Promise<VerifiedApiToken | null> {
    return this.introspector.introspect(token);
  }
  // #endregion
}
