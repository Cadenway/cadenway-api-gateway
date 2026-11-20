/** The fresh single-use credential returned by Identity. */
export interface RealtimeTicket {
  // #region Properties
  /** Opaque ticket for the realtime handshake. */
  readonly token: string;

  /** Exclusive ticket expiration as an ISO timestamp. */
  readonly expiresAt: string;
  // #endregion
}
