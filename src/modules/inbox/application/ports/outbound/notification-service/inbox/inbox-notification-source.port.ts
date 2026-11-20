import type { InboxCandidate } from '../../../../models/inbox/inbox-candidate.model.js';
import type { InboxListQuery } from '../../../../models/inbox/inbox-list-query.model.js';
import type { InboxReadAllResult } from '../../../../models/inbox/inbox-read-all-result.model.js';
import type { InboxSubject } from '../../../../models/inbox/inbox-subject.model.js';

/** Operates only on the inbox of the authenticated recipient in the selected organization. */
export interface InboxNotificationSource {
  // #region Methods
  /** Reads a bounded batch of private candidates. */
  listCandidates(
    query: InboxListQuery,
    signal: AbortSignal,
  ): Promise<{
    readonly items: readonly { readonly record: InboxCandidate; readonly cursorAfter: string }[];
    readonly nextCursor: string | null;
  }>;

  /** Reads weighted exact selectors from one owner generation. */
  listUnreadSubjects(
    cursor: string | null,
    limit: number,
    signal: AbortSignal,
  ): Promise<{
    readonly generation: string;
    readonly items: readonly { readonly subject: InboxSubject | null; readonly count: number }[];
    readonly nextCursor: string | null;
  }>;

  /** Marks the exact authorized set through the fixed creation cutoff. */
  markReadAll(
    selection: {
      readonly snapshotGeneration: string;
      readonly creationCutoff: string;
      readonly authorizedSubjects: readonly InboxSubject[];
    },
    signal: AbortSignal,
  ): Promise<InboxReadAllResult>;
  // #endregion
}
