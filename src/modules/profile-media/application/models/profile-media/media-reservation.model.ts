/** Reservation returned by the service owning an image reference. */
export interface MediaReservation {
  // #region Properties
  /** Owner-allocated upload identifier. */
  readonly uploadId: string;

  /** Exclusive owner lease expiry. */
  readonly expiresAt: string;
  // #endregion
}
