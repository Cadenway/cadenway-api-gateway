import type { RealtimeTicket } from '../../../../models/ticket/realtime-ticket.model.js';
import type { RealtimeTicketIssuer } from '../../../../ports/outbound/identity/ticket/realtime-ticket-issuer.port.js';

/** Requests a fresh, single-use realtime credential. */
export class IssueRealtimeTicket {
  // #region Constructor
  /** Binds the Identity issuer for the verified session. */
  public constructor(private readonly issuer: RealtimeTicketIssuer) {}
  // #endregion

  // #region Methods
  /** Issues exactly once and returns the resulting credential. */
  public execute(sessionId: string): Promise<RealtimeTicket> {
    return this.issuer.issue(sessionId);
  }
  // #endregion
}
