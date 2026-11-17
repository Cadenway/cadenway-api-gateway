import type { OpenSessionPage } from '../../../../models/sessions/open-session-page.model.js';
import type { RevokedSessions } from '../../../../models/sessions/revoked-sessions.model.js';
import type { ListSessionsInput } from '../../../../use-cases/queries/sessions/list-sessions/list-sessions.input.js';

/**
 * Interface SessionRegistry
 *
 * @description
 * Outgoing port of the routes of the open sessions: the sessions of identity-service, called as
 * the user of the current organization context, which never carries an organization these routes
 * need.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of identity-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface SessionRegistry {
  // #region Methods
  /**
   * Method listSessions
   *
   * @description
   * `GET /internal/v1/users/{userId}/sessions?currentSessionId=`. Rejects with
   * `404 session.not-found` when the session of the request is no longer open, or
   * `404 user.not-found`.
   *
   * @param {ListSessionsInput} request - Account, session of the request, cursor and page size.
   * @returns {Promise<OpenSessionPage>} One page of the open sessions.
   */
  listSessions(request: ListSessionsInput): Promise<OpenSessionPage>;

  /**
   * Method revokeSession
   *
   * @description
   * `DELETE /internal/v1/sessions/{sessionId}`. Rejects with `404 session.not-found` for a
   * session of another account or an unknown id.
   *
   * @param {string} sessionId - Id of the session to close.
   * @returns {Promise<void>} Resolves once the session is closed, or had already ended.
   */
  revokeSession(sessionId: string): Promise<void>;

  /**
   * Method revokeOtherSessions
   *
   * @description
   * `POST /internal/v1/sessions/{sessionId}/revoke-others`. Rejects with `404 session.not-found`
   * when the session of the request is no longer open.
   *
   * @param {string} sessionId - Id of the session of the request, the one kept.
   * @returns {Promise<RevokedSessions>} How many sessions were closed.
   */
  revokeOtherSessions(sessionId: string): Promise<RevokedSessions>;
  // #endregion
}
