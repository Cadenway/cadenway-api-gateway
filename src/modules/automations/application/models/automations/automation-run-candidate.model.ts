/** One public-safe execution candidate before the task's current visibility is verified. */
export interface AutomationRunCandidate {
  // #region Properties
  /** Identity of the successful execution. */
  readonly executionId: string;

  /** Identity of the executed rule. */
  readonly ruleId: string;

  /** Key whose current visibility must be checked. */
  readonly taskKey: string;

  /** Action summary, with no comment content. */
  readonly action:
    | { readonly type: 'assign' | 'notify'; readonly userId: string }
    | { readonly type: 'priority'; readonly priority: string }
    | { readonly type: 'comment' };

  /** Time of successful settlement. */
  readonly executedAt: string;
  // #endregion
}
