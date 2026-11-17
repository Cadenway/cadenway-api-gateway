import type { SessionOrganization } from '../../../../models/sessions/session-organization.model.js';

/**
 * Interface SessionOrganizations
 *
 * @description
 * Outgoing port of `PUT /v1/session/organization`: the current organization of a session, kept
 * by identity-service and checked against its copy of the memberships.
 */
export interface SessionOrganizations {
  // #region Methods
  /**
   * Method switchOrganization
   *
   * @description
   * `PUT /internal/v1/sessions/{sessionId}/organization`, as the user of the session.
   *
   * @param {string} sessionId - Id of the session, as the introspection returned it.
   * @param {string} organizationId - The organization to act on.
   * @returns {Promise<SessionOrganization>} The organization and the role of the session.
   * @throws {ProblemException} `404 organization.not-found`, `404 session.not-found`, or
   * `503 upstream.*`.
   */
  switchOrganization(sessionId: string, organizationId: string): Promise<SessionOrganization>;
  // #endregion
}
