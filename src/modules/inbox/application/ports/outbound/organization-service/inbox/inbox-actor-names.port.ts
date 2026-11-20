/** Looks up only actors from notifications whose subjects were already authorized. */
export interface InboxActorNames {
  // #region Methods
  /** Resolves at most 100 member names in the same organization. */
  lookup(
    userIds: readonly string[],
    signal: AbortSignal,
  ): Promise<{ readonly items: readonly { readonly userId: string; readonly name: string }[] }>;
  // #endregion
}
