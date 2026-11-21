import {
  ListBillingInvoicesQueryParams,
  ListBillingInvoicesResponse,
  StartBillingCheckoutBody,
  StartBillingCheckoutHeader,
  StartBillingCheckoutResponse,
} from '@cadenway/contracts/validators/public/billing';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import { relayProblems } from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { StartCheckout } from '../../../../application/use-cases/commands/billing/start-checkout/start-checkout.use-case.js';
import { ListInvoices } from '../../../../application/use-cases/queries/billing/list-invoices/list-invoices.use-case.js';
import { SubscriptionQueryPipe } from '../../validation/billing/subscription-query.validation.js';

const INVOICES_QUERY = ListBillingInvoicesQueryParams.strict();

/** Public Checkout and invoice operations for the current organization owner. */
@Controller('v1/billing')
@UseGuards(CredentialGuard, RateLimitGuard)
export class PaymentsController {
  // #region Constructor
  /** Binds both owner-authorized operations. */
  public constructor(
    @Inject(StartCheckout) private readonly checkout: StartCheckout,
    @Inject(ListInvoices) private readonly invoices: ListInvoices,
  ) {}
  // #endregion

  // #region Methods
  /** Returns the hosted checkout URL for an idempotent request. */
  @Post('checkout')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'startBillingCheckout',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async startCheckout(
    @Query(new SubscriptionQueryPipe()) _query: object,
    @RequiredBody(StartBillingCheckoutBody) body: z.output<typeof StartBillingCheckoutBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof StartBillingCheckoutResponse>> {
    const keys = request.headersDistinct['idempotency-key'];
    const key = toRequestHeader(
      'Idempotency-Key',
      StartBillingCheckoutHeader.shape['Idempotency-Key'],
      keys?.length === 1 ? keys[0] : keys,
    );
    const result = conformBody(
      'billing-service',
      'startBillingCheckout',
      StartBillingCheckoutResponse,
      await relayProblems(
        {
          403: ['organization.role-forbidden'],
          404: ['organization.not-found'],
          409: [
            'billing.subscription-active',
            'billing.checkout-in-progress',
            'idempotency.request-in-progress',
          ],
          422: ['idempotency.key-reused'],
        },
        () => this.checkout.execute(body, key),
        [403, 404, 409, 422, 503],
      ),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }

  /** Returns a validated page of invoices. */
  @Get('invoices')
  @CredentialGuard.requires({
    operationId: 'listBillingInvoices',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async listInvoices(
    @Query(new ZodValidationPipe(INVOICES_QUERY)) query: z.output<typeof INVOICES_QUERY>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof ListBillingInvoicesResponse>> {
    const result = conformBody(
      'billing-service',
      'listBillingInvoices',
      ListBillingInvoicesResponse,
      await relayProblems(
        {
          400: ['billing.invalid-cursor'],
          403: ['organization.role-forbidden'],
          404: ['organization.not-found'],
        },
        () => this.invoices.execute(query),
        [400, 403, 404, 503],
      ),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }
  // #endregion
}
