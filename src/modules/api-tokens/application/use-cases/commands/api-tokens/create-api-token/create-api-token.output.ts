import type { ApiToken } from '../../../../models/api-tokens/api-token.model.js';

/**
 * Interface CreateApiTokenOutput
 *
 * @description
 * The token created and its secret, returned once: never logged, never stored by the gateway.
 */
export interface CreateApiTokenOutput {
  // #region Properties
  /**
   * Property apiToken
   *
   * @description
   * The token.
   *
   * @type {ApiToken}
   * @readonly
   */
  readonly apiToken: ApiToken;

  /**
   * Property secret
   *
   * @description
   * The secret of the token, `cw_pat_...`. A secret.
   *
   * @type {string}
   * @readonly
   */
  readonly secret: string;
  // #endregion
}
