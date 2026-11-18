import type { ConfirmAuthenticatorAppSetupInput } from './confirm-authenticator-app-setup.input.js';
import type { AuthenticatorAppConfigured } from '../../../../models/two-step/authenticator-app-configured.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class ConfirmAuthenticatorAppSetup
 *
 * @description
 * Confirms the pending setup of an authenticator app of the session with one of its codes.
 */
export class ConfirmAuthenticatorAppSetup {
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
   * Confirms the app.
   *
   * @param {ConfirmAuthenticatorAppSetupInput} input - The account, the session, the code and the browser.
   * @returns {Promise<AuthenticatorAppConfigured>} The two-step verification after the change, and the backup codes when it turned on.
   */
  public execute(input: ConfirmAuthenticatorAppSetupInput): Promise<AuthenticatorAppConfigured> {
    return this.registry.confirmAuthenticatorAppSetup(input);
  }
  // #endregion
}
