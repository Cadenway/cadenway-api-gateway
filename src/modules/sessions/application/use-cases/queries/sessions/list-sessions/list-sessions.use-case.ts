import type { ListSessionsInput } from './list-sessions.input.js';
import type { OpenSessionPage } from '../../../../models/sessions/open-session-page.model.js';
import type { SessionRegistry } from '../../../../ports/outbound/identity/sessions/session-registry.port.js';

/**
 * Class ListSessions
 *
 * @description
 * Lists the open sessions of the account of the verified session, the session of the request
 * marked as the current one.
 */
export class ListSessions {
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
   * Reads one page of the open sessions.
   *
   * @param {ListSessionsInput} input - Account, session of the request, cursor and page size.
   * @returns {Promise<OpenSessionPage>} One page of the open sessions.
   */
  public execute(input: ListSessionsInput): Promise<OpenSessionPage> {
    return this.registry.listSessions(input);
  }
  // #endregion
}
