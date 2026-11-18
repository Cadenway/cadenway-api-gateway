import type { SessionRegistry } from '../../../../ports/outbound/identity/sessions/session-registry.port.js';

/**
 * Class RevokeSession
 *
 * @description
 * Closes a session of the account of the verified session, by the id of the public path;
 * identity-service checks that it belongs to the account.
 */
export class RevokeSession {
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
   * Closes the session.
   *
   * @param {string} sessionId - Id of the session to close.
   * @returns {Promise<void>} Resolves once the session is closed, or had already ended.
   */
  public execute(sessionId: string): Promise<void> {
    return this.registry.revokeSession(sessionId);
  }
  // #endregion
}
