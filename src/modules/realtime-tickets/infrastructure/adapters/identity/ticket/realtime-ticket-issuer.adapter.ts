import type { IdentityServiceClient } from '../../../../../../clients/identity-service.client.js';
import type { RealtimeTicketIssuer } from '../../../../application/ports/outbound/identity/ticket/realtime-ticket-issuer.port.js';

/** Adapts the validated Identity client to the capability-owned issuer port. */
export function realtimeTicketIssuer(client: IdentityServiceClient): RealtimeTicketIssuer {
  return { issue: (sessionId) => client.issueRealtimeTicket(sessionId) };
}
