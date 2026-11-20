import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { noStore } from '../../presentation/http/middleware/no-store.middleware.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { RealtimeTicketIssuer } from './application/ports/outbound/identity/ticket/realtime-ticket-issuer.port.js';
import { IssueRealtimeTicket } from './application/use-cases/commands/ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';
import { realtimeTicketIssuer } from './infrastructure/adapters/identity/ticket/realtime-ticket-issuer.adapter.js';
import { RealtimeTicketsController } from './presentation/http/controllers/ticket/realtime-tickets.controller.js';

const TICKET_ISSUER: symbol = Symbol('REALTIME_TICKET_ISSUER');

/** Composes the public realtime ticket issuance route. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [RealtimeTicketsController],
  providers: [
    { provide: TICKET_ISSUER, inject: [IdentityServiceClient], useFactory: realtimeTicketIssuer },
    {
      provide: IssueRealtimeTicket,
      inject: [TICKET_ISSUER],
      useFactory: (issuer: RealtimeTicketIssuer): IssueRealtimeTicket =>
        new IssueRealtimeTicket(issuer),
    },
  ],
})
export class RealtimeTicketsModule implements NestModule {
  // #region Methods
  /** Protects successful responses and guard refusals from caching. */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(noStore).forRoutes(RealtimeTicketsController);
  }
  // #endregion
}
