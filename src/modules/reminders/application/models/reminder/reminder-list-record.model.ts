import type { ReminderListPosition } from './reminder-list-position.model.js';

/** Private reminder data fetched after its exact task binding has been authorized. */
export interface ReminderListRecord extends ReminderListPosition {
  // #region Properties
  /** Stable Task UUID used for the authorization. */
  readonly taskId: string;

  /** The caller's note, if present. */
  readonly note: string | null;

  /** The firing instant, if the schedule has fired. */
  readonly firedAt: string | null;

  /** The completion instant, if the reminder is complete. */
  readonly completedAt: string | null;

  /** The reminder version in the verified generation. */
  readonly version: number;
  // #endregion
}
