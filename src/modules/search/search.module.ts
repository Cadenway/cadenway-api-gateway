import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { SearchServiceClient } from '../../clients/search-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SearchPort } from './application/ports/outbound/search-service/search/search.port.js';
import { SearchPalette } from './application/use-cases/queries/search/search-palette/search-palette.use-case.js';
import { createSearchServiceAdapter } from './infrastructure/adapters/search-service/search/search-service.adapter.js';
import { SearchController } from './presentation/http/controllers/search/search.controller.js';

const SEARCH = Symbol('SEARCH');

/** Composes the session-only palette route and signed Search client. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [SearchController],
  providers: [
    { provide: SEARCH, inject: [SearchServiceClient], useFactory: createSearchServiceAdapter },
    {
      provide: SearchPalette,
      inject: [SEARCH],
      useFactory: (search: SearchPort) => new SearchPalette(search),
    },
  ],
})
export class SearchModule {}
