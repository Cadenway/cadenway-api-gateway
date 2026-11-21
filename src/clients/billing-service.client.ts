import * as schemas from '@cadenway/contracts/validators/internal/billing-service';
import type { InternalHttpClient } from '@cadenway/nest-common';
import type { z } from 'zod';

import { answered, expectBody, outsideContract } from '../problems/upstream-answer.js';
import { getBillingServiceInternalRoutes } from './generated/billing-service.js';

/** Audience and upstream name of the signed Billing client. */
export const BILLING_SERVICE: string = 'billing-service';

const operation = 'getBillingSubscriptionInternal';
const MAX_SUBSCRIPTION_BYTES = 16 * 1024;
type Routes = ReturnType<typeof getBillingServiceInternalRoutes>;

/** Calls Billing with the signed user and organization context. */
export class BillingServiceClient {
  // #region Properties
  /** Generated Billing routes bound to the shared transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the configured Billing transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getBillingServiceInternalRoutes(async (input, init) => {
      if (typeof input !== 'string') throw new Error('The Billing client requires a path.');
      const response = await http.fetch(input, init);
      const body = response.body;
      const length = response.headers.get('Content-Length');
      const encoding = response.headers.get('Content-Encoding')?.trim().toLowerCase();
      const identityEncoding = encoding === undefined || encoding === 'identity';
      if (
        response.status !== 200 ||
        body === null ||
        !/^application\/json(?:\s*;|$)/iu.test(response.headers.get('Content-Type') ?? '') ||
        response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store' ||
        (identityEncoding &&
          length !== null &&
          (!/^\d+$/u.test(length) || Number(length) > MAX_SUBSCRIPTION_BYTES))
      ) {
        void body?.cancel().catch(() => undefined);
        throw outsideContract(BILLING_SERVICE, operation, 'invalid response headers');
      }
      let received = 0;
      const bounded = body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > MAX_SUBSCRIPTION_BYTES) {
              throw outsideContract(BILLING_SERVICE, operation, 'response exceeds its byte limit');
            }
            controller.enqueue(chunk);
          },
          flush() {
            if (identityEncoding && length !== null && received !== Number(length)) {
              throw outsideContract(BILLING_SERVICE, operation, 'response length did not match');
            }
          },
        }),
      );
      return new Response(bounded, { status: response.status, headers: response.headers });
    });
  }
  // #endregion

  // #region Methods
  /** Reads and validates the current organization's subscription and measured usage. */
  public async getSubscription(): Promise<
    z.output<typeof schemas.GetBillingSubscriptionInternalResponse>
  > {
    const response = await answered(
      BILLING_SERVICE,
      operation,
      this.routes.getBillingSubscriptionInternal(),
    );
    return expectBody(
      BILLING_SERVICE,
      operation,
      response,
      200,
      schemas.GetBillingSubscriptionInternalResponse,
    );
  }
  // #endregion
}
