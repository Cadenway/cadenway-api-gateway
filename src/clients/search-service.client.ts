import * as schemas from '@cadenway/contracts/validators/internal/search-service';
import type { InternalHttpClient } from '@cadenway/nest-common';
import type { z } from 'zod';

import { answered, expectBody, outsideContract } from '../problems/upstream-answer.js';
import { getSearchServiceInternalRoutes } from './generated/search-service.js';

/** Audience and upstream name of the signed Search client. */
export const SEARCH_SERVICE: string = 'search-service';

const operation = 'searchInternal';
const MAX_SEARCH_RESPONSE_BYTES = 256 * 1024;
type Routes = ReturnType<typeof getSearchServiceInternalRoutes>;

/** Bounds the JSON response before the generated client reads the stream. */
function boundedSearchResponse(response: Response): Response {
  const body = response.body;
  const length = response.headers.get('Content-Length');
  const encoding = response.headers.get('Content-Encoding')?.trim().toLowerCase();
  const identityEncoding = encoding === undefined || encoding === 'identity';
  if (
    response.status !== 200 ||
    body === null ||
    !/^application\/json(?:\s*;|$)/iu.test(response.headers.get('Content-Type') ?? '') ||
    response.headers.get('Cache-Control')?.toLowerCase() !== 'private, no-store' ||
    (identityEncoding &&
      length !== null &&
      (!/^\d+$/u.test(length) || Number(length) > MAX_SEARCH_RESPONSE_BYTES))
  ) {
    void body?.cancel().catch(() => undefined);
    throw outsideContract(SEARCH_SERVICE, operation, 'invalid response headers');
  }
  let received = 0;
  const bounded = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_SEARCH_RESPONSE_BYTES) {
          throw outsideContract(SEARCH_SERVICE, operation, 'response exceeds its byte limit');
        }
        controller.enqueue(chunk);
      },
      flush() {
        if (identityEncoding && length !== null && received !== Number(length)) {
          throw outsideContract(SEARCH_SERVICE, operation, 'response length did not match');
        }
      },
    }),
  );
  return new Response(bounded, { status: response.status, headers: response.headers });
}

/** Calls the generated Search route using the verified user and organization context. */
export class SearchServiceClient {
  // #region Properties
  /** Generated routes bound to the signed internal transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the configured Search transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getSearchServiceInternalRoutes(async (input, init) => {
      if (typeof input !== 'string') throw new Error('The Search client requires a path.');
      return boundedSearchResponse(await http.fetch(input, init));
    });
  }
  // #endregion

  // #region Methods
  /** Returns a contract-validated page of currently visible Search results. */
  public async search(
    params: z.input<typeof schemas.SearchInternalQueryParams>,
  ): Promise<z.output<typeof schemas.SearchInternalResponse>> {
    const query = schemas.SearchInternalQueryParams.parse(params);
    if (query.cursor !== undefined && (query.cursor.length === 0 || query.cursor.length > 1024)) {
      throw new Error('The gateway built a Search request with an invalid cursor length.');
    }
    const response = await answered(SEARCH_SERVICE, operation, this.routes.searchInternal(query));
    const page = expectBody(
      SEARCH_SERVICE,
      operation,
      response,
      200,
      schemas.SearchInternalResponse,
    );
    if (
      page.items.length > query.limit ||
      (page.nextCursor !== null && page.items.length !== query.limit)
    ) {
      throw outsideContract(SEARCH_SERVICE, operation, 'an invalid page');
    }
    let previous = '';
    for (const item of page.items) {
      const current = item.kind === 'task' ? `0:${item.taskKey}` : `1:${item.listId.toLowerCase()}`;
      if (current <= previous)
        throw outsideContract(SEARCH_SERVICE, operation, 'an invalid page order');
      previous = current;
    }
    return page;
  }
  // #endregion
}
