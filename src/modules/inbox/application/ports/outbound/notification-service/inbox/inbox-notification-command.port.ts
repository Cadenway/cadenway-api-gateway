import type { InboxCandidate } from '../../../../models/inbox/inbox-candidate.model.js';
import type { InboxSubject } from '../../../../models/inbox/inbox-subject.model.js';

/** Private owner-scoped access and checked mutations for one notification. */
export interface InboxNotificationCommand {
  // #region Methods
  /** Reads the owner's exact resource binding. */
  candidate(id: string): Promise<{ readonly id: string; readonly subject: InboxSubject | null }>;

  /** Applies the selected transition only if its original binding still matches. */
  change(
    id: string,
    subject: InboxSubject | null,
    action: 'read' | 'archive',
    ifMatch: string | undefined,
  ): Promise<InboxCandidate>;
  // #endregion
}
