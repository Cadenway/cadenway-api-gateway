import { getOrganizationContext, ProblemException } from '@cadenway/nest-common';

import type { OrganizationServiceClient } from '../../../../../clients/organization-service.client.js';
import type { PaymentsPort } from '../../../application/ports/outbound/billing/payments/payments.port.js';

/** The generated Billing operations needed by the payment capability. */
export interface BillingPaymentsClient {
  // #region Methods
  /** Sends the current owner's checkout request once. */
  startCheckout(body: { readonly plan: 'team' }, key: string): Promise<object>;

  /** Reads a page of the current owner's invoices. */
  listInvoices(query: { readonly cursor?: string; readonly limit: number }): Promise<object>;
  // #endregion
}

const allowedUnavailable = new Set([
  'billing.unavailable',
  'upstream.failed',
  'upstream.unauthorized',
  'upstream.unreachable',
  'upstream.timeout',
  'upstream.unavailable',
  'upstream.circuit-open',
  'upstream.deadline-exceeded',
]);

/** Enforces current ownership for each Billing request, including checkout retries. */
export function createPaymentsAdapter(
  organizations: Pick<OrganizationServiceClient, 'getOrganization'>,
  billing: BillingPaymentsClient,
): PaymentsPort {
  async function requireOwner(): Promise<void> {
    let organization: Awaited<ReturnType<OrganizationServiceClient['getOrganization']>>;
    try {
      organization = await organizations.getOrganization();
    } catch (error: unknown) {
      if (
        error instanceof ProblemException &&
        error.problem.status === 404 &&
        error.problem.code === 'organization.not-found'
      ) {
        throw new ProblemException({ status: 404, code: 'organization.not-found' });
      }
      throw sanitized(error);
    }
    const current = getOrganizationContext()?.organizationId;
    if (organization.id.toLowerCase() !== current?.toLowerCase()) {
      throw new ProblemException({ status: 503, code: 'upstream.failed' });
    }
    if (organization.role !== 'owner') {
      throw new ProblemException({ status: 403, code: 'organization.role-forbidden' });
    }
  }

  async function call(operation: () => Promise<object>): Promise<object> {
    await requireOwner();
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof ProblemException) {
        const { status, code } = error.problem;
        if (
          (status === 409 &&
            [
              'billing.subscription-active',
              'billing.checkout-in-progress',
              'idempotency.request-in-progress',
            ].includes(code)) ||
          (status === 422 && code === 'idempotency.key-reused') ||
          (status === 400 && code === 'billing.invalid-cursor')
        ) {
          throw new ProblemException({ status, code });
        }
      }
      throw sanitized(error);
    }
  }

  return {
    startCheckout: (body, key) => call(() => billing.startCheckout(body, key)),
    listInvoices: (query) => call(() => billing.listInvoices(query)),
  };
}

/** Removes upstream details and translates internal authorization failures. */
function sanitized(error: unknown): ProblemException {
  if (error instanceof ProblemException) {
    const { status, code } = error.problem;
    if (status === 503) {
      return new ProblemException({
        status: 503,
        code: allowedUnavailable.has(code) ? code : 'upstream.failed',
      });
    }
    if (status === 401 || status === 403) {
      return new ProblemException({ status: 503, code: 'upstream.unauthorized' });
    }
  }
  return new ProblemException({ status: 503, code: 'upstream.failed' });
}
