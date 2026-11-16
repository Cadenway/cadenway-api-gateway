import type { VerifiedSession } from '../../../../models/session/verified-session.model.js';
import type { SessionIntrospector } from '../../../../ports/outbound/identity/session/session-introspector.port.js';

/**
 * Class VerifySession
 *
 * @description
 * Verifies each opaque session through the gateway-owned Identity port.
 */
export class VerifySession {
  // #region Properties
  /**
   * Property introspector
   *
   * @description
   * Port for verifying opaque session tokens.
   *
   * @type {SessionIntrospector}
   * @readonly
   */
  private readonly introspector: SessionIntrospector;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the verification port.
   *
   * @param {SessionIntrospector} introspector - Verifies an opaque token through Identity.
   * @constructor
   */
  public constructor(introspector: SessionIntrospector) {
    this.introspector = introspector;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Requests verification of the token for the current request.
   *
   * @param {string} token - Candidate token, which must stay out of logs.
   * @returns {Promise<VerifiedSession | null>} Active session, or null when inactive.
   */
  public execute(token: string): Promise<VerifiedSession | null> {
    return this.introspector.introspect(token);
  }
  // #endregion
}
