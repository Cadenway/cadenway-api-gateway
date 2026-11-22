import * as schemas from '@cadenway/contracts/validators/internal/billing-service';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
import type { z } from 'zod';

import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
} from '../problems/upstream-answer.js';
import { getBillingServiceInternalRoutes } from './generated/billing-service.js';

/** Audience and upstream name of the signed Billing client. */
export const BILLING_SERVICE: string = 'billing-service';

/** Original Stripe delivery received by the public webhook. */
export interface StripeWebhookDelivery {
  // #region Properties
  /** Exact bytes supplied by Stripe. */
  readonly body: Buffer;

  /** Stripe-Signature value to verify against the original body. */
  readonly signature: string;
  // #endregion
}

const operation = 'getBillingSubscriptionInternal';
const MAX_SUBSCRIPTION_BYTES = 16 * 1024;
const MAX_INVOICES_BYTES = 256 * 1024;
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
      if (init?.method === 'POST' && init.body instanceof Blob) {
        if (
          response.status !== 204 ||
          response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store'
        ) {
          void response.body?.cancel().catch(() => undefined);
          throw outsideContract(
            BILLING_SERVICE,
            'receiveStripeBillingWebhookInternal',
            'invalid response headers',
          );
        }
        return response;
      }
      const operationName =
        init?.method === 'POST'
          ? 'startBillingCheckoutInternal'
          : input.split('?', 1)[0] === this.routes.getListBillingInvoicesInternalUrl()
            ? 'listBillingInvoicesInternal'
            : operation;
      const limit =
        operationName === 'listBillingInvoicesInternal'
          ? MAX_INVOICES_BYTES
          : MAX_SUBSCRIPTION_BYTES;
      const body = response.body;
      const length = response.headers.get('Content-Length');
      const encoding = response.headers.get('Content-Encoding')?.trim().toLowerCase();
      const identityEncoding = encoding === undefined || encoding === 'identity';
      if (
        response.status !== 200 ||
        body === null ||
        !/^application\/json(?:\s*;|$)/iu.test(response.headers.get('Content-Type') ?? '') ||
        response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store' ||
        (identityEncoding && length !== null && (!/^\d+$/u.test(length) || Number(length) > limit))
      ) {
        void body?.cancel().catch(() => undefined);
        throw outsideContract(BILLING_SERVICE, operationName, 'invalid response headers');
      }
      let received = 0;
      const bounded = body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            received += chunk.byteLength;
            if (received > limit) {
              throw outsideContract(
                BILLING_SERVICE,
                operationName,
                'response exceeds its byte limit',
              );
            }
            controller.enqueue(chunk);
          },
          flush() {
            if (identityEncoding && length !== null && received !== Number(length)) {
              throw outsideContract(
                BILLING_SERVICE,
                operationName,
                'response length did not match',
              );
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

  /** Starts one hosted Checkout with the current signed user and organization. */
  public async startCheckout(
    body: z.input<typeof schemas.StartBillingCheckoutInternalBody>,
    idempotencyKey: string,
  ): Promise<z.output<typeof schemas.StartBillingCheckoutInternalResponse>> {
    const operationName = 'startBillingCheckoutInternal';
    const options: InternalRequestInit = {
      headers: schemas.StartBillingCheckoutInternalHeader.parse({
        'Idempotency-Key': idempotencyKey,
      }),
      idempotent: false,
    };
    const response = await answered(
      BILLING_SERVICE,
      operationName,
      this.routes.startBillingCheckoutInternal(
        schemas.StartBillingCheckoutInternalBody.parse(body),
        options,
      ),
    );
    return expectBody(
      BILLING_SERVICE,
      operationName,
      response,
      200,
      schemas.StartBillingCheckoutInternalResponse,
    );
  }

  /** Reads an invoice page for the current signed user and organization. */
  public async listInvoices(params: {
    readonly cursor?: string;
    readonly limit?: number;
  }): Promise<z.output<typeof schemas.ListBillingInvoicesInternalResponse>> {
    const operationName = 'listBillingInvoicesInternal';
    const response = await answered(
      BILLING_SERVICE,
      operationName,
      this.routes.listBillingInvoicesInternal(
        schemas.ListBillingInvoicesInternalQueryParams.parse(params),
      ),
    );
    return expectBody(
      BILLING_SERVICE,
      operationName,
      response,
      200,
      schemas.ListBillingInvoicesInternalResponse,
    );
  }

  /** Relays Stripe's original signed bytes once under the gateway system identity. */
  public async receiveStripeWebhook(input: StripeWebhookDelivery): Promise<void> {
    const operation = 'receiveStripeBillingWebhookInternal';
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    const options: InternalRequestInit = {
      headers: { 'Stripe-Signature': input.signature },
      idempotent: false,
      claims: {
        actor: { type: 'system', id: 'api-gateway' },
        organizationId: null,
        role: null,
        scopes: [],
        ...(traceId === undefined ? {} : { traceId }),
      },
    };
    const response = await answered(
      BILLING_SERVICE,
      operation,
      this.routes.receiveStripeBillingWebhookInternal(
        new Blob([Uint8Array.from(input.body)], { type: 'application/json' }),
        options,
      ),
    );
    expectStatus(BILLING_SERVICE, operation, response, 204);
    if (response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store') {
      throw outsideContract(BILLING_SERVICE, operation, 'missing Cache-Control private, no-store');
    }
  }
  // #endregion
}
