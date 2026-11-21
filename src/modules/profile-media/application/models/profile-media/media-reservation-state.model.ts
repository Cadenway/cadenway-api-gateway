import type { MediaReservation } from './media-reservation.model.js';

/** Reservation state rechecked by the owning service before publication. */
export interface MediaReservationState extends MediaReservation {
  // #region Properties
  /** Current owner decision for this reservation. */
  readonly state: 'pending' | 'committed';
  // #endregion
}
