import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';

import { answered, expectStatus, outsideContract } from '../problems/upstream-answer.js';
import { getIntegrationServiceInternalWebhookRoutes } from './generated/integration-service.js';

/** Audience and upstream name of the signed Integration client. */
export const INTEGRATION_SERVICE: string = 'integration-service';

/** Provider delivery received by the public GitHub webhook. */
export interface GitHubWebhookDelivery {
  // #region Properties
  /** Opaque identifier of the configured receiver. */
  readonly bindingId: string;

  /** Provider delivery identifier. */
  readonly delivery: string;

  /** Provider event header. */
  readonly event: string;

  /** Provider signature header. */
  readonly signature: string;

  /** The original uncompressed request body. */
  readonly body: Buffer;
  // #endregion
}

/** Provider delivery received by the public GitLab webhook. */
export interface GitLabWebhookDelivery extends GitHubWebhookDelivery {
  // #region Properties
  /** Timestamp supplied in the signed provider delivery. */
  readonly timestamp: string;
  // #endregion
}

type Routes = ReturnType<typeof getIntegrationServiceInternalWebhookRoutes>;

/** Relays original provider deliveries under a signed system identity. */
export class IntegrationServiceClient {
  // #region Properties
  /** Contract-generated routes backed by the shared transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the Integration service transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getIntegrationServiceInternalWebhookRoutes((input, init) => {
      if (typeof input !== 'string') throw new Error('The Integration client requires a path.');
      return http.fetch(input, init);
    });
  }
  // #endregion

  // #region Methods
  /** Relays GitHub's exact signed body and documented headers once. */
  public async receiveGitHubWebhook(input: GitHubWebhookDelivery): Promise<void> {
    const operation = 'receiveGitHubWebhookInternal';
    const response = await answered(
      INTEGRATION_SERVICE,
      operation,
      this.routes.receiveGitHubWebhookInternal(
        new Blob([Uint8Array.from(input.body)], { type: 'application/json' }),
        { bindingId: input.bindingId },
        this.options({
          'X-GitHub-Delivery': input.delivery,
          'X-GitHub-Event': input.event,
          'X-Hub-Signature-256': input.signature,
        }),
      ),
    );
    this.accepted(operation, response);
  }

  /** Relays GitLab's exact signed body and documented headers once. */
  public async receiveGitLabWebhook(input: GitLabWebhookDelivery): Promise<void> {
    const operation = 'receiveGitLabWebhookInternal';
    const response = await answered(
      INTEGRATION_SERVICE,
      operation,
      this.routes.receiveGitLabWebhookInternal(
        new Blob([Uint8Array.from(input.body)], { type: 'application/json' }),
        { bindingId: input.bindingId },
        this.options({
          'webhook-id': input.delivery,
          'X-Gitlab-Event': input.event,
          'webhook-timestamp': input.timestamp,
          'webhook-signature': input.signature,
        }),
      ),
    );
    this.accepted(operation, response);
  }

  /** Uses explicit system claims even if an unrelated request context exists. */
  private options(headers: Record<string, string>): InternalRequestInit {
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    return {
      headers,
      idempotent: false,
      claims: {
        actor: { type: 'system', id: 'api-gateway' },
        organizationId: null,
        role: null,
        scopes: [],
        ...(traceId === undefined ? {} : { traceId }),
      },
    };
  }

  /** Requires the Integration receipt and its private cache policy. */
  private accepted(
    operation: string,
    response: { readonly status: number; readonly headers: Headers },
  ): void {
    expectStatus(INTEGRATION_SERVICE, operation, { status: response.status, data: undefined }, 204);
    if (response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store') {
      throw outsideContract(
        INTEGRATION_SERVICE,
        operation,
        'missing Cache-Control private, no-store',
      );
    }
  }
  // #endregion
}
