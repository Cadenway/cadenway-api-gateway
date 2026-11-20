/** A sortable position in the owner's current reminder collection. */
export interface ReminderListPosition {
  // #region Properties
  /** The reminder instant, in ISO UTC form from Notification. */
  readonly remindAt: string;

  /** The reminder UUID used to break ties. */
  readonly id: string;
  // #endregion
}
