import * as schemas from '@cadenway/contracts/validators/internal/automation-service';
import {
  formatEtag,
  type InternalHttpClient,
  type InternalRequestInit,
} from '@cadenway/nest-common';
import type { z } from 'zod';

import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
} from '../problems/upstream-answer.js';
import { getAutomationServiceInternalRoutes } from './generated/automation-service.js';

/** Audience and upstream name of the Automation client. */
export const AUTOMATION_SERVICE: string = 'automation-service';

type Routes = ReturnType<typeof getAutomationServiceInternalRoutes>;

/** Calls Automation through the generated routes and validates its receipts and pages. */
export class AutomationServiceClient {
  // #region Properties
  /** Generated routes bound to the signed transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the configured Automation transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getAutomationServiceInternalRoutes((input, init) => {
      if (typeof input !== 'string') throw new Error('The Automation client requires a path.');
      return http.fetch(input, init);
    });
  }
  // #endregion

  // #region Methods
  /** Reads a page of rules under the current tenant and caller. */
  public async listRules(
    query: z.input<typeof schemas.ListAutomationRulesInternalQueryParams>,
  ): Promise<z.output<typeof schemas.ListAutomationRulesInternalResponse>> {
    const operation = 'listAutomationRulesInternal';
    const params = schemas.ListAutomationRulesInternalQueryParams.parse(query);
    const response = await answered(
      AUTOMATION_SERVICE,
      operation,
      this.routes.listAutomationRulesInternal(params),
    );
    const page = expectBody(
      AUTOMATION_SERVICE,
      operation,
      response,
      200,
      schemas.ListAutomationRulesInternalResponse,
    );
    if (page.items.length > params.limit) {
      throw outsideContract(AUTOMATION_SERVICE, operation, 'page exceeds its requested limit');
    }
    return page;
  }

  /** Creates a rule, forwarding its original idempotency key and server-authorized claims. */
  public async createRule(
    body: unknown,
    options: InternalRequestInit,
  ): Promise<z.output<typeof schemas.CreateAutomationRuleInternalResponse>> {
    const operation = 'createAutomationRuleInternal';
    const request = schemas.CreateAutomationRuleInternalBody.parse(body);
    // A repeat must return through Gateway so Organization can issue a fresh authorization.
    const transportOptions: InternalRequestInit = { ...options, idempotent: false };
    const response = await answered(
      AUTOMATION_SERVICE,
      operation,
      this.routes.createAutomationRuleInternal(request, transportOptions),
    );
    const rule = expectBody(
      AUTOMATION_SERVICE,
      operation,
      response,
      201,
      schemas.CreateAutomationRuleInternalResponse,
    );
    if (
      response.headers.get('Location') !== `/internal/v1/automations/${rule.ruleId}` ||
      response.headers.get('ETag') !== formatEtag(rule.version)
    ) {
      throw outsideContract(AUTOMATION_SERVICE, operation, 'inconsistent rule receipt headers');
    }
    return rule;
  }

  /** Enables or disables the requested rule under the optional strong version. */
  public async updateRule(
    id: string,
    body: z.input<typeof schemas.UpdateAutomationRuleInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.UpdateAutomationRuleInternalResponse>> {
    const operation = 'updateAutomationRuleInternal';
    const { ruleId } = schemas.UpdateAutomationRuleInternalParams.parse({ ruleId: id });
    const request = schemas.UpdateAutomationRuleInternalBody.parse(body);
    const response = await answered(
      AUTOMATION_SERVICE,
      operation,
      this.routes.updateAutomationRuleInternal(
        ruleId,
        request,
        ifMatch === undefined ? undefined : { headers: { 'If-Match': ifMatch } },
      ),
    );
    const rule = expectBody(
      AUTOMATION_SERVICE,
      operation,
      response,
      200,
      schemas.UpdateAutomationRuleInternalResponse,
    );
    if (
      rule.ruleId.toLowerCase() !== ruleId.toLowerCase() ||
      rule.enabled !== request.enabled ||
      response.headers.get('ETag') !== formatEtag(rule.version)
    ) {
      throw outsideContract(AUTOMATION_SERVICE, operation, 'inconsistent updated rule receipt');
    }
    return rule;
  }

  /** Deletes a rule once, retaining the caller's optional version condition. */
  public async deleteRule(id: string, ifMatch?: string): Promise<void> {
    const operation = 'deleteAutomationRuleInternal';
    const { ruleId } = schemas.DeleteAutomationRuleInternalParams.parse({ ruleId: id });
    const options: InternalRequestInit = {
      idempotent: false,
      ...(ifMatch === undefined ? {} : { headers: { 'If-Match': ifMatch } }),
    };
    const response = await answered(
      AUTOMATION_SERVICE,
      operation,
      this.routes.deleteAutomationRuleInternal(ruleId, options),
    );
    expectStatus(AUTOMATION_SERVICE, operation, response, 204);
  }

  /** Reads a bounded internal page for the Gateway's separate task visibility checks. */
  public async listRunCandidates(
    query: z.input<typeof schemas.ListAutomationRunCandidatesInternalQueryParams>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.ListAutomationRunCandidatesInternalResponse>> {
    const operation = 'listAutomationRunCandidatesInternal';
    const params = schemas.ListAutomationRunCandidatesInternalQueryParams.parse(query);
    const response = await answered(
      AUTOMATION_SERVICE,
      operation,
      this.routes.listAutomationRunCandidatesInternal(params, signal ? { signal } : undefined),
    );
    const page = expectBody(
      AUTOMATION_SERVICE,
      operation,
      response,
      200,
      schemas.ListAutomationRunCandidatesInternalResponse,
    );
    if (
      page.items.length > params.limit ||
      (page.nextCursor !== null && (page.nextCursor === params.cursor || page.items.length === 0))
    ) {
      throw outsideContract(AUTOMATION_SERVICE, operation, 'inconsistent candidate window');
    }
    return page;
  }
  // #endregion
}
