import {
  getOrganizationContext,
  ProblemException,
  type InternalRequestInit,
} from '@cadenway/nest-common';
import { z } from 'zod';

import type { AutomationServiceClient } from '../../../../../clients/automation-service.client.js';
import {
  ORGANIZATION_SERVICE,
  type OrganizationServiceClient,
} from '../../../../../clients/organization-service.client.js';
import {
  TASK_SERVICE,
  type TaskServiceClient,
} from '../../../../../clients/task-service.client.js';
import type { AutomationRegistry } from '../../../application/ports/outbound/automation-service/rules/automation-registry.port.js';

const recipientId = z.uuidv7();
const unavailableCodes = new Set([
  'upstream.unavailable',
  'upstream.unreachable',
  'upstream.timeout',
  'upstream.circuit-open',
  'upstream.failed',
  'upstream.unauthorized',
  'upstream.deadline-exceeded',
]);
const taskTokenRefusals = new Set([
  'auth.issuer-not-allowed',
  'auth.actor-not-allowed',
  'auth.organization-required',
]);

function dependencyFailure(service: string, code = 'upstream.failed'): ProblemException {
  return new ProblemException({ status: 503, code, details: { service } });
}

/** Builds the tenant-bound registry using only verified request context and live service decisions. */
export function createAutomationRegistry(
  organizations: Pick<OrganizationServiceClient, 'getOrganization' | 'checkAutomationRecipient'>,
  automation: Pick<
    AutomationServiceClient,
    'listRules' | 'createRule' | 'updateRule' | 'deleteRule' | 'listRunCandidates'
  >,
  task: Pick<TaskServiceClient, 'getTask'>,
): AutomationRegistry {
  function context() {
    const current = getOrganizationContext();
    if (!current?.organizationId) {
      throw new ProblemException({ status: 403, code: 'organization.not-selected' });
    }
    if (current.actor.type !== 'user' || current.actor.id === null) {
      throw new ProblemException({ status: 401, code: 'auth.session-required' });
    }
    return current;
  }

  async function authorize(signal?: AbortSignal): Promise<void> {
    const current = context();
    const organization = await organizations.getOrganization(signal);
    if (organization.id.toLowerCase() !== current.organizationId?.toLowerCase()) {
      throw dependencyFailure(ORGANIZATION_SERVICE);
    }
    if (organization.role !== 'owner' && organization.role !== 'admin') {
      throw new ProblemException({ status: 403, code: 'organization.role-forbidden' });
    }
  }

  return {
    authorize,
    async list(query) {
      await authorize();
      return automation.listRules(query);
    },
    async create(body, key) {
      const current = context();
      const { action } = body;
      const scopes: string[] = [];
      if (action.type === 'assign' || action.type === 'notify') {
        if (!recipientId.safeParse(action.userId).success) {
          throw new ProblemException({
            status: 400,
            code: 'request.invalid',
            details: { issues: [{ path: 'action.userId', in: 'body', code: 'invalid_format' }] },
          });
        }
        const id = action.userId.toLowerCase();
        if (!(await organizations.checkAutomationRecipient(id))) {
          throw new ProblemException({ status: 422, code: 'automation.recipient-ineligible' });
        }
        scopes.push(`automation:recipient:${id}`);
      } else {
        await authorize();
      }
      const options: InternalRequestInit = {
        claims: { actor: current.actor, organizationId: current.organizationId, scopes },
        ...(key === undefined ? {} : { headers: { 'Idempotency-Key': key } }),
      };
      try {
        return await automation.createRule(body, options);
      } catch (error) {
        if (
          error instanceof ProblemException &&
          error.problem.status === 422 &&
          error.problem.code === 'automation.recipient-ineligible'
        ) {
          throw new ProblemException({ status: 422, code: 'automation.recipient-ineligible' });
        }
        throw error;
      }
    },
    async update(ruleId, body, ifMatch) {
      await authorize();
      return automation.updateRule(ruleId, body, ifMatch);
    },
    async delete(ruleId, ifMatch) {
      await authorize();
      await automation.deleteRule(ruleId, ifMatch);
    },
    listRunCandidates(query, signal) {
      return automation.listRunCandidates(query, signal);
    },
    async canReadTask(taskKey, signal) {
      try {
        const visible = await task.getTask(taskKey, signal);
        if (visible.key !== taskKey) {
          throw dependencyFailure(TASK_SERVICE);
        }
        return true;
      } catch (error) {
        if (error instanceof ProblemException) {
          const { status, code } = error.problem;
          if (status === 404 && (code === 'task.not-found' || code === 'task.trashed'))
            return false;
          if (status === 503 && unavailableCodes.has(code))
            throw dependencyFailure(TASK_SERVICE, code);
          if (status === 401 || (status === 403 && taskTokenRefusals.has(code))) {
            throw dependencyFailure(TASK_SERVICE, 'upstream.unauthorized');
          }
        }
        throw dependencyFailure(TASK_SERVICE);
      }
    },
  };
}
