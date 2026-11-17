import type { RevokedSessions } from '../../../../models/sessions/revoked-sessions.model.js';
import type { SessionRegistry } from '../../../../ports/outbound/identity/sessions/session-registry.port.js';

/**
 * Class RevokeOtherSessions
 *
 * @description
 * Closes every open session of the account except the verified session of the request.
 */
export class RevokeOtherSessions {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The sessions of identity-service.
   *
   * @type {SessionRegistry}
   * @readonly
   */
  private readonly registry: SessionRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {SessionRegistry} registry - The sessions of identity-service.
   * @constructor
   */
  public constructor(registry: SessionRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Closes the other sessions.
   *
   * @param {string} sessionId - Id of the session of the request, as its introspection returned
   * it: the one kept.
   * @returns {Promise<RevokedSessions>} How many sessions were closed.
   */
  public execute(sessionId: string): Promise<RevokedSessions> {
    return this.registry.revokeOtherSessions(sessionId);
  }
  // #endregion
}
