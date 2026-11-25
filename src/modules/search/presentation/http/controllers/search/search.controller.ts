import { SearchResponse } from '@cadenway/contracts/validators/public/search';
import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import { relayProblems } from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { SearchPalette } from '../../../../application/use-cases/queries/search/search-palette/search-palette.use-case.js';
import { SearchQueryPipe } from '../../validation/search/search-query-pipe.validation.js';
import { searchQueryValidation } from '../../validation/search/search-query.validation.js';

/** Public palette search for the current verified organization session. */
@Controller('v1/search')
@UseGuards(CredentialGuard, RateLimitGuard)
export class SearchController {
  // #region Constructor
  /** Binds the palette query. */
  public constructor(@Inject(SearchPalette) private readonly palette: SearchPalette) {}
  // #endregion

  // #region Methods
  /** Returns a private page of results authorized by Search. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'search',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async search(
    @Query(new SearchQueryPipe())
    query: z.output<typeof searchQueryValidation>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SearchResponse>> {
    const result = conformBody(
      'search-service',
      'search',
      SearchResponse,
      await relayProblems(
        { 400: ['request.invalid'], 404: ['organization.not-found'], 503: ['search.unavailable'] },
        () => this.palette.execute(query),
        [404],
      ),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }
  // #endregion
}
