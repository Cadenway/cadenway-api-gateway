import type { RemoveSecurityKeyInput } from './remove-security-key.input.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class RemoveSecurityKey
 *
 * @description
 * Removes a security key of the account of the request.
 */
export class RemoveSecurityKey {
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
   * Removes the key.
   *
   * @param {RemoveSecurityKeyInput} input - The account, the session, the key and the browser.
   * @returns {Promise<void>} Resolves once the key is removed.
   */
  public execute(input: RemoveSecurityKeyInput): Promise<void> {
    return this.registry.removeSecurityKey(input);
  }
  // #endregion
}
