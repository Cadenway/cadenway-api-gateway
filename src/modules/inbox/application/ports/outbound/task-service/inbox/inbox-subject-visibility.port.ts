import type { InboxVisibilityDecision } from '../../../../models/inbox/inbox-visibility-decision.model.js';
import type { InboxVisibilityInput } from '../../../../models/inbox/inbox-visibility-input.model.js';

/** Resolves current access as the same authenticated user and organization. */
export interface InboxSubjectVisibility {
  // #region Methods
  /** Checks at most 100 subjects and preserves the input order. */
  resolve(
    inputs: readonly InboxVisibilityInput[],
    signal: AbortSignal,
  ): Promise<readonly InboxVisibilityDecision[]>;
  // #endregion
}
