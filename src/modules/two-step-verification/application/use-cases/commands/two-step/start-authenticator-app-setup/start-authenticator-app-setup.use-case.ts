import type { AccountSession } from '../../../../models/two-step/account-session.model.js';
import type { AuthenticatorAppSetup } from '../../../../models/two-step/authenticator-app-setup.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class StartAuthenticatorAppSetup
 *
 * @description
 * Starts the setup of an authenticator app for the session of the request, which replaces its pending setup.
 */
export class StartAuthenticatorAppSetup {
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
   * Starts the setup.
   *
   * @param {AccountSession} input - The account and the session of the request.
   * @returns {Promise<AuthenticatorAppSetup>} The secret of the new app, returned once.
   */
  public execute(input: AccountSession): Promise<AuthenticatorAppSetup> {
    return this.registry.startAuthenticatorAppSetup(input);
  }
  // #endregion
}
