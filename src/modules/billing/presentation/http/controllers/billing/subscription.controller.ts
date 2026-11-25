import { GetBillingSubscriptionResponse } from '@cadenway/contracts/validators/public/billing';
import { Controller, Get, Inject, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import { relayProblems } from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { GetSubscription } from '../../../../application/use-cases/queries/billing/get-subscription/get-subscription.use-case.js';
import { SubscriptionQueryPipe } from '../../validation/billing/subscription-query.validation.js';

/** Public subscription read for the current owner of the selected organization. */
@Controller('v1/billing')
@UseGuards(CredentialGuard, RateLimitGuard)
export class SubscriptionController {
  // #region Constructor
  /** Binds the current-owner subscription query. */
  public constructor(@Inject(GetSubscription) private readonly subscription: GetSubscription) {}
  // #endregion

  // #region Methods
  /** Returns the validated subscription and usage without allowing response caching. */
  @Get('subscription')
  @CredentialGuard.requires({
    operationId: 'getBillingSubscription',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getSubscription(
    @Query(new SubscriptionQueryPipe()) _query: object,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetBillingSubscriptionResponse>> {
    const result = conformBody(
      'billing-service',
      'getBillingSubscription',
      GetBillingSubscriptionResponse,
      await relayProblems(
        { 403: ['organization.role-forbidden'], 404: ['organization.not-found'] },
        () => this.subscription.execute(),
        [403, 404, 503],
      ),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }
  // #endregion
}
