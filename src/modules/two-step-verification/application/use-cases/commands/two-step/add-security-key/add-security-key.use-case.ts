import type { AddSecurityKeyInput } from './add-security-key.input.js';
import type { SecurityKey } from '../../../../models/two-step/security-key.model.js';
import type { TwoStepVerificationRegistry } from '../../../../ports/outbound/identity/two-step/two-step-verification-registry.port.js';

/**
 * Class AddSecurityKey
 *
 * @description
 * Registers a security key from the answer of the browser to the pending registration of the session.
 */
export class AddSecurityKey {
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
   * Registers the key.
   *
   * @param {AddSecurityKeyInput} input - The account, the session, the name, the answer and the browser.
   * @returns {Promise<SecurityKey>} The key registered.
   */
  public execute(input: AddSecurityKeyInput): Promise<SecurityKey> {
    return this.registry.addSecurityKey(input);
  }
  // #endregion
}
