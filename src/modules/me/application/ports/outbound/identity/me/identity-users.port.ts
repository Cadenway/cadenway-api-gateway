import type { ProfileChanges } from '../../../../models/me/profile-changes.model.js';
import type { GetCurrentUserOutput } from '../../../../use-cases/queries/me/get-current-user/get-current-user.output.js';

/**
 * Interface IdentityUsers
 *
 * @description
 * Outgoing port of `GET /v1/me` and `PATCH /v1/me`: the accounts of identity-service. Implemented by the
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

  /**
   * Method updateUser
   *
   * @description
   * `PATCH /internal/v1/users/{userId}`, with the `If-Match` of the public request. A user
   * changes its own account only.
   *
   * @param {string} userId - Id of the account, as the introspection returned it.
   * @param {ProfileChanges} changes - JSON Merge Patch of the profile.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<GetCurrentUserOutput>} The account after the change.
   * @throws {ProblemException} `400 request.invalid`, `404 user.not-found`,
   * `412 request.version-mismatch`, or `503 upstream.*`.
   */
  updateUser(
    userId: string,
    changes: ProfileChanges,
    ifMatch: string | undefined,
  ): Promise<GetCurrentUserOutput>;
  // #endregion
}
