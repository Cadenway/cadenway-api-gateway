import type { ReminderListPosition } from '../../../../models/reminder/reminder-list-position.model.js';
import type { ReminderListRecord } from '../../../../models/reminder/reminder-list-record.model.js';

/** Reads candidates and confirms an exact selection in the current owner generation. */
export interface ReminderListSource {
  // #region Methods
  /** Reads a candidate page. Null represents the contracted generation conflict. */
  page(
    query: { readonly limit: number; readonly cursor?: string },
    signal: AbortSignal,
  ): Promise<{
    readonly generation: string;
    readonly items: readonly (ReminderListPosition & { readonly taskId: string })[];
    readonly nextCursor: string | null;
  } | null>;

  /** Fetches the checked pairs in order, including a generation check on empty input. */
  selected(
    generation: string,
    pairs: readonly { readonly id: string; readonly taskId: string }[],
    signal: AbortSignal,
  ): Promise<readonly ReminderListRecord[] | null>;
  // #endregion
}
