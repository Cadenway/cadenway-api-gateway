/** Asks Task for positional access decisions and optional safe display for task UUIDs. */
export interface ReminderTaskDirectory {
  // #region Methods
  /** Checks up to 100 UUIDs for the same signed actor in one Task snapshot. */
  lookup(
    taskIds: readonly string[],
    includeDisplay: boolean,
    signal: AbortSignal,
  ): Promise<
    readonly (
      | { readonly visible: false }
      | {
          readonly visible: true;
          readonly display?: {
            readonly taskId: string;
            readonly taskKey: string;
            readonly taskName: string;
          };
        }
    )[]
  >;
  // #endregion
}
