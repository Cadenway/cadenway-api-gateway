import type { User } from '@cadenway/contracts/types/internal/identity-service';

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
   * @returns {Promise<User>} The account, matched against the internal contract.
   * @throws {ProblemException} `404 user.not-found` when the account is not readable, or
   * `503 upstream.*` when identity-service cannot answer or answers outside its contract.
   */
  getUser(userId: string): Promise<User>;
  // #endregion
}

/**
 * Constant IDENTITY_USERS
 *
 * @description
 * Injection token of the `IdentityUsers` port, provided globally by `ClientsModule`.
 *
 * @type {unique symbol}
 */
export const IDENTITY_USERS: unique symbol = Symbol('IdentityUsers');
