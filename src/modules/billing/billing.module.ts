import { Module } from '@nestjs/common';

import { BillingServiceClient } from '../../clients/billing-service.client.js';
import { ClientsModule } from '../../clients/clients.module.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SubscriptionPort } from './application/ports/outbound/billing/subscription/subscription.port.js';
import { GetSubscription } from './application/use-cases/queries/billing/get-subscription/get-subscription.use-case.js';
import { createSubscriptionAdapter } from './infrastructure/adapters/billing/subscription.adapter.js';
import { SubscriptionController } from './presentation/http/controllers/billing/subscription.controller.js';

const SUBSCRIPTION = Symbol('SUBSCRIPTION');

/** Composes the owner-authorized subscription route and its source clients. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [SubscriptionController],
  providers: [
    {
      provide: SUBSCRIPTION,
      inject: [OrganizationServiceClient, BillingServiceClient],
      useFactory: createSubscriptionAdapter,
    },
    {
      provide: GetSubscription,
      inject: [SUBSCRIPTION],
      useFactory: (subscription: SubscriptionPort): GetSubscription =>
        new GetSubscription(subscription),
    },
  ],
})
export class BillingModule {}
