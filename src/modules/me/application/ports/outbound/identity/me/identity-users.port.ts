import type { GetCurrentUserOutput } from '../../../../use-cases/queries/me/get-current-user/get-current-user.output.js';

/**
 * Interface IdentityUsers
 *
 * @description
 * Outgoing port of `GET /v1/me`: the accounts of identity-service. Implemented by the
 * identity-service client of `src/clients/`, which signs the call as the user of the current
 * organization context.
 */
export interface IdentityUsers {
  // #region Methods
  /**
   * Method getUser
   *
   * @description
   * `GET /internal/v1/users/{userId}`. A user reads its own account only.
   *
   * @param {string} userId - Id of the account, as the introspection returned it.
   * @returns {Promise<GetCurrentUserOutput>} The account, matched against the internal contract.
   * @throws {ProblemException} `404 user.not-found` when the account is not readable, or
   * `503 upstream.*` when identity-service cannot answer or answers outside its contract.
   */
  getUser(userId: string): Promise<GetCurrentUserOutput>;
  // #endregion
}
