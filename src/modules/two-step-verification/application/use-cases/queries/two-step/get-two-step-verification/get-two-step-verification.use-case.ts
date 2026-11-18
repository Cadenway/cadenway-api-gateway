import type { AccountSession } from '../../../../models/two-step/account-session.model.js';
import type { TwoStepVerification } from '../../../../models/two-step/two-step-verification.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class GetTwoStepVerification
 *
 * @description
 * Reads the two-step verification of the account of the request.
 */
export class GetTwoStepVerification {
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
   * Reads the two-step verification.
   *
   * @param {AccountSession} input - The account of the request.
   * @returns {Promise<TwoStepVerification>} The two-step verification, without any secret.
   */
  public execute(input: AccountSession): Promise<TwoStepVerification> {
    return this.registry.getTwoStepVerification(input);
  }
  // #endregion
}
