import type { ApiTokenPage } from '../../../../models/api-tokens/api-token-page.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';
import type { ApiTokenRegistry } from '../../../../ports/outbound/identity/api-tokens/api-token-registry.port.js';

/**
 * Class ListApiTokens
 *
 * @description
 * Lists the active personal API tokens of the caller in the current organization.
 */
export class ListApiTokens {
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
   * Reads one page of the tokens.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<ApiTokenPage>} One page of tokens, never with their secret.
   */
  public execute(page: PageRequest): Promise<ApiTokenPage> {
    return this.registry.listApiTokens(page);
  }
  // #endregion
}
