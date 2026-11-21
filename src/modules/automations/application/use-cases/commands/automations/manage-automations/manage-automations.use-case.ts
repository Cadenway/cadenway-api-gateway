import type { AutomationRuleRequest } from '../../../../models/automations/automation-rule-request.model.js';
import type { AutomationRegistry } from '../../../../ports/outbound/automation-service/rules/automation-registry.port.js';

/** Relays rule commands under current organization authority. */
export class ManageAutomations {
  // #region Constructor
  /** Binds the registry that checks authority and recipient eligibility. */
  public constructor(private readonly registry: AutomationRegistry) {}
  // #endregion

  // #region Methods
  /** Creates, updates or removes a rule under the caller's current authority. */
  public async execute(
    input:
      | {
          readonly kind: 'create';
          readonly body: AutomationRuleRequest;
          readonly key: string | undefined;
        }
      | {
          readonly kind: 'update';
          readonly ruleId: string;
          readonly body: { readonly enabled: boolean };
          readonly ifMatch: string | undefined;
        }
      | { readonly kind: 'delete'; readonly ruleId: string; readonly ifMatch: string | undefined },
  ): Promise<object | undefined> {
    switch (input.kind) {
      case 'create':
        return this.registry.create(input.body, input.key);
      case 'update':
        return this.registry.update(input.ruleId, input.body, input.ifMatch);
      case 'delete':
        await this.registry.delete(input.ruleId, input.ifMatch);
        return undefined;
    }
  }
  // #endregion
}
