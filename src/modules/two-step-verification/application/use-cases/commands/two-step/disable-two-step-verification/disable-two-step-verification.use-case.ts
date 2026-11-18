import type { AccountChange } from '../../../../models/two-step/account-change.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class DisableTwoStepVerification
 *
 * @description
 * Turns the two-step verification of the account of the request off, once identity-service checked the policies of its organizations and the recent authentication of the session.
 */
export class DisableTwoStepVerification {
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
   * Turns two-step verification off.
   *
   * @param {AccountChange} input - The account, the session and the browser of the request.
   * @returns {Promise<void>} Resolves once it is off.
   */
  public execute(input: AccountChange): Promise<void> {
    return this.registry.disableTwoStepVerification(input);
  }
  // #endregion
}
