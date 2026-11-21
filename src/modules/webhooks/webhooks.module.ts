import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IntegrationServiceClient } from '../../clients/integration-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { GitWebhookReceiver } from './application/ports/outbound/integration-service/deliveries/git-webhook-receiver.port.js';
import { ReceiveGitWebhook } from './application/use-cases/commands/deliveries/receive-git-webhook/receive-git-webhook.use-case.js';
import { createGitWebhookReceiver } from './infrastructure/adapters/integration-service/deliveries/git-webhook-receiver.adapter.js';
import { GitWebhooksController } from './presentation/http/controllers/deliveries/git-webhooks.controller.js';

const GIT_WEBHOOK_RECEIVER = Symbol('GIT_WEBHOOK_RECEIVER');

/** Composes the public Git delivery routes with the signed Integration client. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [GitWebhooksController],
  providers: [
    {
      provide: GIT_WEBHOOK_RECEIVER,
      inject: [IntegrationServiceClient],
      useFactory: createGitWebhookReceiver,
    },
    {
      provide: ReceiveGitWebhook,
      inject: [GIT_WEBHOOK_RECEIVER],
      useFactory: (receiver: GitWebhookReceiver) => new ReceiveGitWebhook(receiver),
    },
  ],
})
export class WebhooksModule {}
