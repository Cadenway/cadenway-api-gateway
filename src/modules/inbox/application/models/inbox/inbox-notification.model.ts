/** Public display data composed only after current authorization. */
export interface InboxNotification {
  // #region Properties
  /** Stable notification identity and its display category. */
  readonly id: string;
  readonly kind: string;

  /** An actor resolved in the active organization, when available. */
  readonly actor: { readonly userId: string; readonly name: string } | null;

  /** An authorized task summary, when the notification refers to a task. */
  readonly task: { readonly taskKey: string; readonly name: string } | null;

  /** Live comment excerpt and status hint for a visible task. */
  readonly excerpt: string | null;
  readonly status: string | null;

  /** Notification timestamps and optimistic version. */
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly archivedAt: string | null;
  readonly version: number;
  // #endregion
}
