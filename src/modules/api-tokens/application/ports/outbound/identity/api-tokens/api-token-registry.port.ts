import type { CreateApiTokenInput } from '../../../../use-cases/commands/api-tokens/create-api-token/create-api-token.input.js';
import type { CreateApiTokenOutput } from '../../../../use-cases/commands/api-tokens/create-api-token/create-api-token.output.js';
import type { ApiTokenPage } from '../../../../models/api-tokens/api-token-page.model.js';
import type { PageRequest } from '../../../../models/pages/page-request.model.js';

/**
 * Interface ApiTokenRegistry
 *
 * @description
 * Outgoing port of the personal API token routes: the tokens of identity-service, called as the
 * user of the current organization context, in its organization (the current organization of the
 * session).
 *
 * Every method resolves with a response that matched the internal contract, and rejects with a
 * `ProblemException`: the client error of identity-service with its `code` and `details`, or
 * `503 upstream.*` when it cannot answer or answers outside its contract.
 */
export interface ApiTokenRegistry {
  // #region Methods
  /**
   * Method createApiToken
   *
   * @description
   * `POST /internal/v1/api-tokens`.
   *
   * @param {CreateApiTokenInput} creation - Name, scopes and expiration.
   * @returns {Promise<CreateApiTokenOutput>} The token and its secret, once.
   */
  createApiToken(creation: CreateApiTokenInput): Promise<CreateApiTokenOutput>;

  /**
   * Method listApiTokens
   *
   * @description
   * `GET /internal/v1/api-tokens`.
   *
   * @param {PageRequest} page - Cursor and page size.
   * @returns {Promise<ApiTokenPage>} One page of tokens.
   */
  listApiTokens(page: PageRequest): Promise<ApiTokenPage>;

  /**
   * Method revokeApiToken
   *
   * @description
   * `DELETE /internal/v1/api-tokens/{apiTokenId}`.
   *
   * @param {string} apiTokenId - Id of the token.
   * @returns {Promise<void>} Resolves once the token is revoked.
   */
  revokeApiToken(apiTokenId: string): Promise<void>;
  // #endregion
}
