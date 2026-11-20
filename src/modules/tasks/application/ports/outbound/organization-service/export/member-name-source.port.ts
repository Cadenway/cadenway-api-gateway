/** Resolves names in the verified request's organization through its internal client. */
export interface MemberNameSource {
  // #region Methods
  /** Looks up up to 5,000 accounts from the authorized task rows, omitting unknown names. */
  lookup(
    userIds: readonly string[],
    signal: AbortSignal,
  ): Promise<{ readonly items: readonly { readonly userId: string; readonly name: string }[] }>;
  // #endregion
}
