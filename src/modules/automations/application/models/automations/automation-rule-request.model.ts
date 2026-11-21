/** A rule body already validated by the incoming adapter. */
export interface AutomationRuleRequest {
  // #region Properties
  /** The task event that starts the rule. */
  readonly trigger:
    { readonly type: 'created' } | { readonly type: 'status'; readonly status: string };

  /** The one action the rule applies. */
  readonly action:
    | { readonly type: 'assign' | 'notify'; readonly userId: string }
    | { readonly type: 'priority'; readonly priority: string }
    | { readonly type: 'comment'; readonly body: string };
  // #endregion
}
