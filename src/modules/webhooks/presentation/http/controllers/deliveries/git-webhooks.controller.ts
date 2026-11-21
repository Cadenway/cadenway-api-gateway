import {
  ReceiveGitHubWebhookHeader,
  ReceiveGitHubWebhookQueryParams,
  ReceiveGitLabWebhookHeader,
  ReceiveGitLabWebhookQueryParams,
} from '@cadenway/contracts/validators/public/webhooks';
import { ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, HttpCode, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';

import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { WebhookRateLimitGuard } from '../../../../../rate-limit/public/requests/webhook-rate-limit-guard.js';
import { ReceiveGitWebhook } from '../../../../application/use-cases/commands/deliveries/receive-git-webhook/receive-git-webhook.use-case.js';

/** Reads a single wire header without silently joining repeated values. */
function header(request: Request, name: string): unknown {
  const values = request.headersDistinct[name.toLowerCase()];
  return values?.length === 1 ? values[0] : values;
}

/** Refuses absent or malformed provider authentication without disclosing its contents. */
function providerSignature(request: Request, name: string, schema: z.ZodType<string>): string {
  const parsed = schema.safeParse(header(request, name));
  if (!parsed.success)
    throw new ProblemException({ status: 401, code: 'webhook.authentication-failed' });
  return parsed.data;
}

/** Accepts the byte buffer installed by the dedicated raw JSON parser. */
function rawBody(request: Request): Buffer {
  if (!request.is('application/json') || !Buffer.isBuffer(request.body)) {
    throw new ProblemException({ status: 400, code: 'request.invalid' });
  }
  return request.body;
}

/** Public provider deliveries are forwarded to Integration for verification. */
@Controller('v1/webhooks')
@UseGuards(CredentialGuard, WebhookRateLimitGuard)
export class GitWebhooksController {
  // #region Constructor
  /** Binds the raw delivery relay. */
  public constructor(@Inject(ReceiveGitWebhook) private readonly receive: ReceiveGitWebhook) {}
  // #endregion

  // #region Methods
  /** Forwards a GitHub delivery without decoding or transforming its bytes. */
  @Post('github')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'receiveGitHubWebhook',
    security: [],
    organization: false,
  })
  @WebhookRateLimitGuard.provider('github')
  public async github(
    @Req() request: Request,
    @Query(new ZodValidationPipe(ReceiveGitHubWebhookQueryParams.strict()))
    query: z.output<typeof ReceiveGitHubWebhookQueryParams>,
  ): Promise<void> {
    const headers = ReceiveGitHubWebhookHeader.shape;
    await this.receive.execute({
      provider: 'github',
      delivery: {
        bindingId: query.bindingId,
        delivery: toRequestHeader(
          'X-GitHub-Delivery',
          headers['X-GitHub-Delivery'],
          header(request, 'X-GitHub-Delivery'),
        ),
        event: toRequestHeader(
          'X-GitHub-Event',
          headers['X-GitHub-Event'],
          header(request, 'X-GitHub-Event'),
        ),
        signature: providerSignature(
          request,
          'X-Hub-Signature-256',
          headers['X-Hub-Signature-256'],
        ),
        body: rawBody(request),
      },
    });
  }

  /** Forwards a GitLab delivery and its signed timestamp unchanged. */
  @Post('gitlab')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'receiveGitLabWebhook',
    security: [],
    organization: false,
  })
  @WebhookRateLimitGuard.provider('gitlab')
  public async gitlab(
    @Req() request: Request,
    @Query(new ZodValidationPipe(ReceiveGitLabWebhookQueryParams.strict()))
    query: z.output<typeof ReceiveGitLabWebhookQueryParams>,
  ): Promise<void> {
    const headers = ReceiveGitLabWebhookHeader.shape;
    await this.receive.execute({
      provider: 'gitlab',
      delivery: {
        bindingId: query.bindingId,
        delivery: toRequestHeader(
          'webhook-id',
          headers['webhook-id'],
          header(request, 'webhook-id'),
        ),
        event: toRequestHeader(
          'X-Gitlab-Event',
          headers['X-Gitlab-Event'],
          header(request, 'X-Gitlab-Event'),
        ),
        timestamp: toRequestHeader(
          'webhook-timestamp',
          headers['webhook-timestamp'],
          header(request, 'webhook-timestamp'),
        ),
        signature: providerSignature(request, 'webhook-signature', headers['webhook-signature']),
        body: rawBody(request),
      },
    });
  }
  // #endregion
}
