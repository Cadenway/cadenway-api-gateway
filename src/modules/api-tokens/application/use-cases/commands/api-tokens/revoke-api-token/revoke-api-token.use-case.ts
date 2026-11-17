import type { ApiTokenRegistry } from '../../../../ports/outbound/identity/api-tokens/api-token-registry.port.js';

/**
 * Class RevokeApiToken
 *
 * @description
 * Revokes a personal API token of the caller in the current organization; the next request with it answers `401 auth.api-token-invalid`.
 */
export class RevokeApiToken {
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
   * Revokes the token.
   *
   * @param {string} apiTokenId - Id of the token.
   * @returns {Promise<void>} Resolves once the token is revoked, or was already.
   */
  public execute(apiTokenId: string): Promise<void> {
    return this.registry.revokeApiToken(apiTokenId);
  }
  // #endregion
}
