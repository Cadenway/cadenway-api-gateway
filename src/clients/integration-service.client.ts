import {
  ListTaskGitLinksInternalQueryParams,
  ListTaskGitLinksInternalResponse,
} from '@cadenway/contracts/validators/internal/integration-service';
import {
  ProblemException,
  type InternalHttpClient,
  type InternalRequestInit,
} from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
import type { z } from 'zod';

import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
} from '../problems/upstream-answer.js';
import { getIntegrationServiceInternalRoutes } from './generated/integration-service.js';

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

type Routes = ReturnType<typeof getIntegrationServiceInternalRoutes>;

/**
 * Relays original provider deliveries under a signed system identity, and reads the Git links of
 * a task under the signed identity of the current user and organization.
 */
export class IntegrationServiceClient {
  // #region Properties
  /** Contract-generated routes backed by the shared transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the Integration service transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getIntegrationServiceInternalRoutes((input, init) => {
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

  /**
   * Reads one page of the Git links of a task, newest first, for the current user and
   * organization. Integration does not decide task visibility: callers read the task through
   * task-service first. The read is idempotent, so the shared client retries it once after a
   * connection error or a `503`.
   *
   * @param {string} taskKey - Key of a task the actor may read.
   * @param {unknown} query - The `cursor` and `limit` the public validator accepted.
   * @param {AbortSignal | undefined} signal - Cancels the read, as the task detail does past its
   * part deadline.
   * @returns {Promise<z.output<typeof ListTaskGitLinksInternalResponse>>} The page, checked
   * against the internal contract.
   * @throws {ProblemException} `400 request.invalid` for a refused cursor; `503 upstream.*`
   * otherwise, for `integration.unavailable`, a missing private cache policy or a link of another
   * task included.
   */
  public async listTaskGitLinks(
    taskKey: string,
    query: unknown,
    signal?: AbortSignal,
  ): Promise<z.output<typeof ListTaskGitLinksInternalResponse>> {
    const operation = 'listTaskGitLinksInternal';
    const parsed = ListTaskGitLinksInternalQueryParams.safeParse(query);
    if (!parsed.success) {
      throw new Error(`The gateway built ${operation} outside the internal contract.`);
    }
    const options: InternalRequestInit = {
      idempotent: true,
      ...(signal === undefined ? {} : { signal }),
    };
    const response = await answered(
      INTEGRATION_SERVICE,
      operation,
      this.routes
        .listTaskGitLinksInternal(taskKey, parsed.data, options)
        .catch((error: unknown) => {
          throw publicUnavailable(error);
        }),
    );
    const page = expectBody(
      INTEGRATION_SERVICE,
      operation,
      response,
      200,
      ListTaskGitLinksInternalResponse,
    );
    if (response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'private, no-store') {
      throw outsideContract(
        INTEGRATION_SERVICE,
        operation,
        'missing Cache-Control private, no-store',
      );
    }
    if (page.items.some((link) => link.taskKey !== taskKey)) {
      throw outsideContract(INTEGRATION_SERVICE, operation, 'a Git link of another task');
    }
    return page;
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

/**
 * Function publicUnavailable
 *
 * @description
 * The shared client lets `503 integration.unavailable` through for the webhook relay, whose public
 * contract declares it. The Git link reads declare only the gateway's `upstream.*` codes, so this
 * read answers it as `503 upstream.unavailable`, naming integration-service.
 *
 * @param {unknown} error - What the generated call threw.
 * @returns {unknown} The error to throw.
 */
function publicUnavailable(error: unknown): unknown {
  if (
    error instanceof ProblemException &&
    error.problem.status === 503 &&
    error.problem.code === 'integration.unavailable'
  ) {
    return new ProblemException({
      status: 503,
      code: 'upstream.unavailable',
      detail: 'A service this request depends on is not available.',
      details: { service: INTEGRATION_SERVICE },
      cause: error,
    });
  }
  return error;
}
