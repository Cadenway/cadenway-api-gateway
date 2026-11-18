import type { AccountSession } from '../../../../models/two-step/account-session.model.js';
import type { SecurityKeyRegistration } from '../../../../models/two-step/security-key-registration.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class StartSecurityKeyRegistration
 *
 * @description
 * Starts the registration of a security key for the session of the request, which replaces its pending registration.
 */
export class StartSecurityKeyRegistration {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The two-step verification of identity-service.
   *
   * @type {TwoStepVerificationRegistry}
   * @readonly
   */
  private readonly registry: TwoStepVerificationRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {TwoStepVerificationRegistry} registry - The two-step verification of identity-service.
   * @constructor
   */
  public constructor(registry: TwoStepVerificationRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Starts the registration.
   *
   * @param {AccountSession} input - The account and the session of the request.
   * @returns {Promise<SecurityKeyRegistration>} The WebAuthn creation options and their expiry.
   */
  public execute(input: AccountSession): Promise<SecurityKeyRegistration> {
    return this.registry.startSecurityKeyRegistration(input);
  }
  // #endregion
}
