import type { RealtimeTicket } from '../../../../models/ticket/realtime-ticket.model.js';

/** The Identity operation that issues one credential to a verified session. */
export interface RealtimeTicketIssuer {
  // #region Methods
  /** Requests one ticket for the current organization-bound session. */
  issue(sessionId: string): Promise<RealtimeTicket>;
  // #endregion
}
