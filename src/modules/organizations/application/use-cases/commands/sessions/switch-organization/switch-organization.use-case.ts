import type { SwitchOrganizationInput } from './switch-organization.input.js';
import type { SessionOrganization } from '../../../../models/sessions/session-organization.model.js';
import type { SessionOrganizations } from '../../../../ports/outbound/identity/sessions/session-organizations.port.js';

/**
 * Class SwitchOrganization
 *
 * @description
 * Makes an organization the caller belongs to the current organization of the session, through identity-service, which checks the membership against its copy of the memberships.
 */
export class SwitchOrganization {
  // #region Properties
  /**
   * Property sessions
   *
   * @description
   * The current organization of the sessions of identity-service.
   *
   * @type {SessionOrganizations}
   * @readonly
   */
  private readonly sessions: SessionOrganizations;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {SessionOrganizations} sessions - The current organization of the sessions of identity-service.
   * @constructor
   */
  public constructor(sessions: SessionOrganizations) {
    this.sessions = sessions;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Chooses the current organization of the session.
   *
   * @param {SwitchOrganizationInput} input - The session and the organization.
   * @returns {Promise<SessionOrganization>} The organization and the role of the session.
   */
  public execute(input: SwitchOrganizationInput): Promise<SessionOrganization> {
    return this.sessions.switchOrganization(input.sessionId, input.organizationId);
  }
  // #endregion
}
