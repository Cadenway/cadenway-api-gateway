import type { AutomationRunCandidate } from './automation-run-candidate.model.js';

/** A newest-first bounded page of internal execution candidates. */
export interface AutomationRunCandidatePage {
  // #region Properties
  /** Candidate executions in source order. */
  readonly items: readonly AutomationRunCandidate[];

  /** An advancing cursor, or null when the window is exhausted. */
  readonly nextCursor: string | null;
  // #endregion
}
