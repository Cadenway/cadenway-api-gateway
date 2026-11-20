import type { SprintReportCursorScope } from '../../../../models/reporting/sprint-report-cursor-scope.model.js';

/** Authenticates pagination cursors crossing the Sprint report boundary. */
export interface SprintReportCursorCodec {
  // #region Methods
  /** Seals a verified Task cursor for this scope. */
  seal(cursor: string, scope: SprintReportCursorScope): string | null;

  /** Opens a public cursor only if it belongs to this scope. */
  open(cursor: string, scope: SprintReportCursorScope): string | null;
  // #endregion
}
