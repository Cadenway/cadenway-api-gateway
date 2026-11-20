import type { InboxSubject } from './inbox-subject.model.js';

/** Recipient-owned candidate awaiting current resource authorization. */
export interface InboxCandidate {
  // #region Properties
  /** Stable public notification identity and its display category. */
  readonly id: string;
  readonly kind: string;

  /** Private references and historical display hints. */
  readonly subject: InboxSubject | null;
  readonly actorUserId: string | null;
  readonly commentId?: string;
  readonly status?: string;

  /** Notification timestamps and optimistic version. */
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly archivedAt: string | null;
  readonly version: number;
  // #endregion
}
