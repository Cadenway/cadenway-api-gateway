import type {
  ApiToken as PublicApiToken,
  ApiTokenCreated,
  ApiTokenPage as PublicApiTokenPage,
} from '@cadenway/contracts/types/public/api-tokens';

import type { ApiToken } from '../../../../application/models/api-tokens/api-token.model.js';
import type { ApiTokenPage } from '../../../../application/models/api-tokens/api-token-page.model.js';
import type { CreateApiTokenOutput } from '../../../../application/use-cases/commands/api-tokens/create-api-token/create-api-token.output.js';

/**
 * Function toApiToken
 *
 * @description
 * Maps a token to `ApiToken` of `openapi/public/api-tokens.yaml`, member by member: never its
 * secret.
 *
 * @param {ApiToken} token - The token.
 * @returns {PublicApiToken} The public token.
 */
export function toApiToken(token: ApiToken): PublicApiToken {
  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    scopes: [...token.scopes],
    organizationId: token.organizationId,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
  };
}

/**
 * Function toApiTokenCreated
 *
 * @description
 * Maps the creation to `ApiTokenCreated`: the token, and its secret, returned this once.
 *
 * @param {CreateApiTokenOutput} created - The token and its secret.
 * @returns {ApiTokenCreated} The public answer.
 */
export function toApiTokenCreated(created: CreateApiTokenOutput): ApiTokenCreated {
  return { apiToken: toApiToken(created.apiToken), secret: created.secret };
}

/**
 * Function toApiTokenPage
 *
 * @description
 * Maps a page of tokens to `ApiTokenPage`, member by member.
 *
 * @param {ApiTokenPage} page - The page.
 * @returns {PublicApiTokenPage} The public page.
 */
export function toApiTokenPage(page: ApiTokenPage): PublicApiTokenPage {
  return { items: page.items.map(toApiToken), nextCursor: page.nextCursor };
}
