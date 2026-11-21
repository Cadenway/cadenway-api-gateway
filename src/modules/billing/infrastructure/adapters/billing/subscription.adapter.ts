import { getOrganizationContext, ProblemException } from '@cadenway/nest-common';

import type { BillingServiceClient } from '../../../../../clients/billing-service.client.js';
import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import type { SubscriptionPort } from '../../../application/ports/outbound/billing/subscription/subscription.port.js';

const permittedUnavailableCodes = [
  'billing.unavailable',
  'upstream.failed',
  'upstream.unauthorized',
  'upstream.unreachable',
  'upstream.timeout',
  'upstream.unavailable',
  'upstream.circuit-open',
  'upstream.deadline-exceeded',
];

/** Reads current Organization authority before calling Billing with the same verified context. */
export function createSubscriptionAdapter(
  organizations: Pick<OrganizationServiceClient, 'getOrganization'>,
  billing: Pick<BillingServiceClient, 'getSubscription'>,
): SubscriptionPort {
  return {
    async read(): Promise<object> {
      let organization: Awaited<ReturnType<OrganizationServiceClient['getOrganization']>>;
      try {
        organization = await organizations.getOrganization();
      } catch (error: unknown) {
        if (!(error instanceof ProblemException)) throw error;
        const { status, code } = error.problem;
        if (status === 404 && code === 'organization.not-found') {
          throw new ProblemException({ status: 404, code });
        }
        if (status === 503) {
          throw new ProblemException({
            status: 503,
            code: permittedUnavailableCodes.includes(code) ? code : 'upstream.failed',
          });
        }
        if (status === 401 || status === 403) {
          throw new ProblemException({ status: 503, code: 'upstream.unauthorized' });
        }
        throw new ProblemException({ status: 503, code: 'upstream.failed' });
      }
      const organizationId = getOrganizationContext()?.organizationId;
      if (organization.id.toLowerCase() !== organizationId?.toLowerCase()) {
        throw new ProblemException({ status: 503, code: 'upstream.failed' });
      }
      if (organization.role !== 'owner') {
        throw new ProblemException({ status: 403, code: 'organization.role-forbidden' });
      }
      try {
        return await billing.getSubscription();
      } catch (error: unknown) {
        if (!(error instanceof ProblemException)) throw error;
        const { status, code } = error.problem;
        if (status === 503) {
          throw new ProblemException({
            status: 503,
            code: permittedUnavailableCodes.includes(code) ? code : 'upstream.failed',
          });
        }
        if (status === 401 || status === 403) {
          throw new ProblemException({ status: 503, code: 'upstream.unauthorized' });
        }
        throw new ProblemException({ status: 503, code: 'upstream.failed' });
      }
    },
  };
}
