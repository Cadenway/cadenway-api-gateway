import type { CreateApiTokenInput } from './create-api-token.input.js';
import type { CreateApiTokenOutput } from './create-api-token.output.js';
import type { ApiTokenRegistry } from '../../../../ports/outbound/identity/api-tokens/api-token-registry.port.js';

/**
 * Class CreateApiToken
 *
 * @description
 * Creates a personal API token of the caller in the current organization of the session, through identity-service, which generates the secret and keeps only its hash.
 */
export class CreateApiToken {
  // #region Properties
  /**
   * Property registry
   *
   * @description
   * The personal API tokens of identity-service.
   *
   * @type {ApiTokenRegistry}
   * @readonly
   */
  private readonly registry: ApiTokenRegistry;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the outbound port of the operation.
   *
   * @param {ApiTokenRegistry} registry - The personal API tokens of identity-service.
   * @constructor
   */
  public constructor(registry: ApiTokenRegistry) {
    this.registry = registry;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Creates the token.
   *
   * @param {CreateApiTokenInput} input - Name, scopes and expiration.
   * @returns {Promise<CreateApiTokenOutput>} The token and its secret, once.
   */
  public execute(input: CreateApiTokenInput): Promise<CreateApiTokenOutput> {
    return this.registry.createApiToken(input);
  }
  // #endregion
}
