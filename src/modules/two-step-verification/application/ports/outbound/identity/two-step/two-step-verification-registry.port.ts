import type { AccountChange } from '../../../../models/two-step/account-change.model.js';
import type { AccountSession } from '../../../../models/two-step/account-session.model.js';
import type { AuthenticatorAppConfigured } from '../../../../models/two-step/authenticator-app-configured.model.js';
import type { AuthenticatorAppSetup } from '../../../../models/two-step/authenticator-app-setup.model.js';
import type { BackupCodes } from '../../../../models/two-step/backup-codes.model.js';
import type { SecurityKeyRegistration } from '../../../../models/two-step/security-key-registration.model.js';
import type { SecurityKey } from '../../../../models/two-step/security-key.model.js';
import type { TwoStepVerification } from '../../../../models/two-step/two-step-verification.model.js';
import type { AddSecurityKeyInput } from '../../../../use-cases/commands/two-step/add-security-key/add-security-key.input.js';
import type { ConfirmAuthenticatorAppSetupInput } from '../../../../use-cases/commands/two-step/confirm-authenticator-app-setup/confirm-authenticator-app-setup.input.js';
import type { RemoveSecurityKeyInput } from '../../../../use-cases/commands/two-step/remove-security-key/remove-security-key.input.js';

/**
 * Interface TwoStepVerificationRegistry
 *
 * @description
 * Outgoing port of the routes under `/v1/me/two-step-verification`: the two-step verification of
 * identity-service, called as the user of the current organization context, for the account and
 * the session the introspection returned.
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of identity-service with its `code` and `details`
 * (`404 session.not-found` or `404 user.not-found` when the session or the account of the request
 * can no longer be used, `403 auth.reauthentication-required` without a recent authentication),
 * or `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface TwoStepVerificationRegistry {
  // #region Methods
  /**
   * Method getTwoStepVerification
   *
   * @description
   * `GET /internal/v1/users/{userId}/two-step-verification`.
   *
   * @param {AccountSession} request - The account of the request.
   * @returns {Promise<TwoStepVerification>} The two-step verification, without any secret.
   */
  getTwoStepVerification(request: AccountSession): Promise<TwoStepVerification>;

  /**
   * Method disableTwoStepVerification
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/disable`. Rejects with
   * `409 auth.mfa-required-by-organization`, then `403 auth.reauthentication-required`.
   *
   * @param {AccountChange} request - The account, the session and the browser.
   * @returns {Promise<void>} Resolves once it is off, or was already.
   */
  disableTwoStepVerification(request: AccountChange): Promise<void>;

  /**
   * Method startAuthenticatorAppSetup
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup`. Rejects with
   * `403 auth.reauthentication-required`.
   *
   * @param {AccountSession} request - The account and the session.
   * @returns {Promise<AuthenticatorAppSetup>} The secret of the new app, returned once.
   */
  startAuthenticatorAppSetup(request: AccountSession): Promise<AuthenticatorAppSetup>;

  /**
   * Method confirmAuthenticatorAppSetup
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/authenticator-app/setup/confirmation`.
   * Rejects with `422 auth.two-step-setup-expired` or `422 auth.two-step-code-invalid`.
   *
   * @param {ConfirmAuthenticatorAppSetupInput} request - The account, the session, the code and
   * the browser.
   * @returns {Promise<AuthenticatorAppConfigured>} The two-step verification after the change and
   * the backup codes when it turned on.
   */
  confirmAuthenticatorAppSetup(
    request: ConfirmAuthenticatorAppSetupInput,
  ): Promise<AuthenticatorAppConfigured>;

  /**
   * Method regenerateBackupCodes
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/backup-codes/regenerate`. Rejects
   * with `409 auth.two-step-not-enabled`, then `403 auth.reauthentication-required`.
   *
   * @param {AccountChange} request - The account, the session and the browser.
   * @returns {Promise<BackupCodes>} The new codes, returned once.
   */
  regenerateBackupCodes(request: AccountChange): Promise<BackupCodes>;

  /**
   * Method startSecurityKeyRegistration
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys/registration`. Rejects
   * with `409 auth.two-step-not-enabled` or `409 auth.security-key-limit-reached`, then
   * `403 auth.reauthentication-required`.
   *
   * @param {AccountSession} request - The account and the session.
   * @returns {Promise<SecurityKeyRegistration>} The WebAuthn creation options.
   */
  startSecurityKeyRegistration(request: AccountSession): Promise<SecurityKeyRegistration>;

  /**
   * Method addSecurityKey
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys`. Rejects with
   * `409 auth.two-step-not-enabled`, `409 auth.security-key-limit-reached`,
   * `422 auth.two-step-setup-expired` or `422 auth.security-key-refused`.
   *
   * @param {AddSecurityKeyInput} request - The account, the session, the name, the answer of the
   * browser and the browser.
   * @returns {Promise<SecurityKey>} The key registered.
   */
  addSecurityKey(request: AddSecurityKeyInput): Promise<SecurityKey>;

  /**
   * Method removeSecurityKey
   *
   * @description
   * `POST /internal/v1/users/{userId}/two-step-verification/security-keys/{securityKeyId}/remove`.
   * Rejects with `404 security-key.not-found`, then `403 auth.reauthentication-required`.
   *
   * @param {RemoveSecurityKeyInput} request - The account, the session, the key and the browser.
   * @returns {Promise<void>} Resolves once the key is removed.
   */
  removeSecurityKey(request: RemoveSecurityKeyInput): Promise<void>;
  // #endregion
}
