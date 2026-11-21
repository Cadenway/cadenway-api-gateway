import type { AutomationRuleRequest } from '../../../../models/automations/automation-rule-request.model.js';
import type { AutomationRulesQuery } from '../../../../models/automations/automation-rules-query.model.js';
import type { AutomationRunCandidatePage } from '../../../../models/automations/automation-run-candidate-page.model.js';

/** Authorized upstream operations for the selected organization's automations. */
export interface AutomationRegistry {
  // #region Methods
  /** Confirms the caller currently manages the organization. */
  authorize(signal?: AbortSignal): Promise<void>;

  /** Reads one page of rules for the current caller. */
  list(query: AutomationRulesQuery): Promise<object>;

  /** Rechecks current role and eligibility before forwarding a create or replay. */
  create(body: AutomationRuleRequest, key: string | undefined): Promise<object>;

  /** Changes a rule's enabled state under the optional version condition. */
  update(
    ruleId: string,
    body: { readonly enabled: boolean },
    ifMatch: string | undefined,
  ): Promise<object>;

  /** Deletes a rule under the optional version condition. */
  delete(ruleId: string, ifMatch: string | undefined): Promise<void>;

  /** Returns at most the requested limit; any continuation advances from a nonempty page. */
  listRunCandidates(
    query: AutomationRulesQuery,
    signal?: AbortSignal,
  ): Promise<AutomationRunCandidatePage>;

  /** Checks current visibility with the original caller under Task's read policy. */
  canReadTask(taskKey: string, signal?: AbortSignal): Promise<boolean>;
  // #endregion
}
