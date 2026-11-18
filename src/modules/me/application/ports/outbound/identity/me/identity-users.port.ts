import type { DeletionScheduled } from '../../../../models/me/deletion-scheduled.model.js';
import type { EmailChangeCodeSent } from '../../../../models/me/email-change-code-sent.model.js';
import type { ProfileChanges } from '../../../../models/me/profile-changes.model.js';
import type { ChangePasswordInput } from '../../../../use-cases/commands/me/change-password/change-password.input.js';
import type { ConfirmEmailChangeInput } from '../../../../use-cases/commands/me/confirm-email-change/confirm-email-change.input.js';
import type { RequestEmailChangeInput } from '../../../../use-cases/commands/me/request-email-change/request-email-change.input.js';
import type { ScheduleAccountDeletionInput } from '../../../../use-cases/commands/me/schedule-account-deletion/schedule-account-deletion.input.js';
import type { GetCurrentUserOutput } from '../../../../use-cases/queries/me/get-current-user/get-current-user.output.js';

/**
 * Interface IdentityUsers
 *
 * @description
 * Outgoing port of the routes of `/v1/me`: the accounts of identity-service. Implemented by the
 * identity-service client of `src/clients/`, which signs the call as the user of the current
 * organization context.
 *
 * The routes about the security of the account name the session the introspection returned
 * (`sessionId`); identity-service answers `404 session.not-found` when it is no longer an open
 * session of the user, and `404 user.not-found` when the account is not readable. Every method
 * rejects with a `ProblemException`: a client error of identity-service with its `code` and
 * `details`, or `503 upstream.*` when identity-service cannot answer or answers outside its
 * contract.
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

  /**
   * Method changePassword
   *
   * @description
   * `PUT /internal/v1/users/{userId}/password`.
   *
   * @param {ChangePasswordInput} change - Account, session, current and new passwords, browser.
   * @returns {Promise<GetCurrentUserOutput>} The account after the change.
   * @throws {ProblemException} `422 auth.password-too-short`, `auth.password-compromised` or
   * `auth.password-incorrect`, `429 auth.account-locked`, `404 user.not-found` or
   * `session.not-found`, or `503 upstream.*`.
   */
  changePassword(change: ChangePasswordInput): Promise<GetCurrentUserOutput>;

  /**
   * Method requestEmailChange
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change`.
   *
   * @param {RequestEmailChangeInput} request - Account, session and new address.
   * @returns {Promise<EmailChangeCodeSent>} When the code expires and when another can be asked
   * for.
   * @throws {ProblemException} `403 auth.reauthentication-required`, `422 auth.email-unchanged`,
   * `409 auth.email-taken`, `429 auth.code-throttled`, `404 user.not-found` or
   * `session.not-found`, or `503 upstream.*`.
   */
  requestEmailChange(request: RequestEmailChangeInput): Promise<EmailChangeCodeSent>;

  /**
   * Method confirmEmailChange
   *
   * @description
   * `POST /internal/v1/users/{userId}/email-change/confirmation`.
   *
   * @param {ConfirmEmailChangeInput} confirmation - Account, session, code and browser.
   * @returns {Promise<GetCurrentUserOutput>} The account with its new address.
   * @throws {ProblemException} `422 auth.code-invalid` or `auth.code-expired`,
   * `409 auth.email-taken`, `404 user.not-found` or `session.not-found`, or `503 upstream.*`.
   */
  confirmEmailChange(confirmation: ConfirmEmailChangeInput): Promise<GetCurrentUserOutput>;

  /**
   * Method scheduleAccountDeletion
   *
   * @description
   * `POST /internal/v1/users/{userId}/deletion`.
   *
   * @param {ScheduleAccountDeletionInput} request - Account and session.
   * @returns {Promise<DeletionScheduled>} When the account will be deleted.
   * @throws {ProblemException} `409 account.organization-owner`,
   * `403 auth.reauthentication-required`, `404 user.not-found` or `session.not-found`, or
   * `503 upstream.*`.
   */
  scheduleAccountDeletion(request: ScheduleAccountDeletionInput): Promise<DeletionScheduled>;
  // #endregion
}
